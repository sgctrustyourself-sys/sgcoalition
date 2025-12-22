import { ethers } from 'ethers';

export interface WalletData {
    address: string;
    balance?: string;
    chainId?: string;
    sgCoinBalance?: number;
}

// Window interface declaration removed to avoid conflict


// SGCoin Token Contract Address on Polygon
const SGCOIN_CONTRACT_ADDRESS = '0x951806a2581c22C478aC613a675e6c898E2aBe21';
const POLYGON_CHAIN_ID = 137;

// ERC-20 ABI (minimal - just what we need for balanceOf)
const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function name() view returns (string)'
];

// ERC-1155 ABI (for OpenSea Shared Storefront)
const ERC1155_ABI = [
    'function balanceOf(address account, uint256 id) view returns (uint256)'
];

export const getSGCoinBalance = async (address: string, provider: ethers.Provider): Promise<number> => {
    try {
        const network = await provider.getNetwork();

        // Check if we're on Polygon
        if (Number(network.chainId) !== POLYGON_CHAIN_ID) {
            console.warn('Not on Polygon network. SGCoin balance will be 0.');
            return 0;
        }

        const contract = new ethers.Contract(SGCOIN_CONTRACT_ADDRESS, ERC20_ABI, provider);
        const balance = await contract.balanceOf(address);
        const decimals = await contract.decimals();

        // Convert from wei to token amount
        const formattedBalance = Number(ethers.formatUnits(balance, decimals));
        return Math.floor(formattedBalance); // Return as integer
    } catch (error) {
        console.error('Error fetching SGCoin balance:', error);
        return 0;
    }
};

export const checkNftOwnership = async (
    contractAddress: string,
    tokenId: string,
    walletAddress: string,
    existingProvider?: ethers.BrowserProvider
): Promise<boolean> => {
    try {
        if (!(window as any).ethereum) return false;

        const provider = existingProvider || new ethers.BrowserProvider((window as any).ethereum);
        const network = await provider.getNetwork();

        if (Number(network.chainId) !== POLYGON_CHAIN_ID) {
            // Ideally switch network here, but for check we just return false if wrong net
            return false;
        }

        const contract = new ethers.Contract(contractAddress, ERC1155_ABI, provider);
        const balance = await contract.balanceOf(walletAddress, tokenId);
        return balance > 0n;
    } catch (error) {
        console.error("Error checking NFT ownership:", error);
        return false;
    }
};

export const connectWallet = async (): Promise<WalletData | null> => {
    if (!(window as any).ethereum) {
        alert("MetaMask is not installed. Please install it to use Web3 features.");
        return null;
    }

    try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);

        if (accounts.length === 0) {
            console.warn("No accounts found.");
            return null;
        }

        const address = accounts[0];
        const balanceBigInt = await provider.getBalance(address);
        const balance = ethers.formatEther(balanceBigInt);
        const network = await provider.getNetwork();

        // Fetch SGCoin balance
        const sgCoinBalance = await getSGCoinBalance(address, provider);

        return {
            address,
            balance,
            chainId: network.chainId.toString(),
            sgCoinBalance
        };

    } catch (error: any) {
        if (error.code === 4001) {
            console.log("User rejected the connection request.");
        } else {
            console.error("Error connecting wallet:", error);
        }
        return null;
    }
};

export const formatAddress = (address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const listenForAccountChanges = (callback: (account: string | null) => void) => {
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', (accounts: string[]) => {
            if (accounts.length > 0) {
                callback(accounts[0]);
            } else {
                callback(null);
            }
        });
    }
};

export const switchToPolygon = async (): Promise<boolean> => {
    if (!window.ethereum) return false;

    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x89' }], // 0x89 is 137 in hex (Polygon)
        });
        return true;
    } catch (switchError: any) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0x89',
                        chainName: 'Polygon Mainnet',
                        nativeCurrency: {
                            name: 'MATIC',
                            symbol: 'MATIC',
                            decimals: 18
                        },
                        rpcUrls: ['https://polygon-rpc.com/'],
                        blockExplorerUrls: ['https://polygonscan.com/']
                    }]
                });
                return true;
            } catch (addError) {
                console.error('Error adding Polygon network:', addError);
                return false;
            }
        }
        console.error('Error switching to Polygon:', switchError);
        return false;
    }
};

export const payWithCrypto = async (amountUSD: number, merchantAddress: string): Promise<string | null> => {
    try {
        if (!window.ethereum) throw new Error("No crypto wallet found");

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        // For MVP, we'll convert USD to ETH roughly (assuming $3000 ETH for safety/demo)
        // In production, you'd want a real price feed.
        const ethPrice = 3000;
        const amountInEth = (amountUSD / ethPrice).toFixed(18);

        const tx = await signer.sendTransaction({
            to: merchantAddress,
            value: ethers.parseEther(amountInEth.toString())
        });

        await tx.wait();
        return tx.hash;
    } catch (error) {
        console.error("Payment failed:", error);
        return null;
    }
};
