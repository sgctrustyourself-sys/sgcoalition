import { ethers } from 'ethers';
import {
    SGCOIN_V1_CONTRACT_ADDRESS,
    SGCOIN_V2_CONTRACT_ADDRESS,
    SGCOIN_BURN_ADDRESS,
    SGCOIN_LIQUIDITY_PROVIDER,
    POLYGON_CHAIN_ID,
    MINI_WIZARDS_CONTRACT_ADDRESS,
    POLYGON_RPC_URLS,
    POLYGON_RPC_URL
} from '../constants';
import { fetchBurnActivity } from '../utils/polygonScanApi';

/**
 * Creates a robust Ethers provider with static network info
 */
export const getStaticProvider = () => {
    return new ethers.JsonRpcProvider(POLYGON_RPC_URL, {
        chainId: 137,
        name: 'polygon'
    }, {
        staticNetwork: true
    });
};

/**
 * Attempts to get a working provider from a list of RPCs
 */
export const getRobustProvider = async (): Promise<ethers.JsonRpcProvider> => {
    for (const url of POLYGON_RPC_URLS) {
        try {
            const provider = new ethers.JsonRpcProvider(url, { chainId: 137, name: 'polygon' }, { staticNetwork: true });
            await provider.getNetwork();
            return provider;
        } catch (e) {
            console.warn(`RPC ${url} failed, trying next...`);
        }
    }
    return getStaticProvider(); // Fallback to default
};

export interface WalletData {
    address: string;
    balance?: string;
    chainId?: string;
    sgCoinBalance?: string;
    v2Balance?: string;
    totalMigratedV1?: string;
}

declare global {
    interface Window {
        ethereum?: any;
    }
}

// ERC-20 ABI (minimal - just what we need for balanceOf)
const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function name() view returns (string)',
    'event Transfer(address indexed from, address indexed to, uint256 value)'
];

const SAFE_MIGRATION_ABI = [
    'event Migrated(address indexed user, uint256 v1Amount, uint256 v2Amount, string tier)'
];

// ERC-1155 ABI (for OpenSea Shared Storefront)
const ERC1155_ABI = [
    'function balanceOf(address account, uint256 id) view returns (uint256)'
];

export const getSGCoinBalance = async (address: string, provider: ethers.Provider): Promise<string> => {
    try {
        const network = await provider.getNetwork();

        // Check if we're on Polygon
        if (Number(network.chainId) !== POLYGON_CHAIN_ID) {
            console.warn('Not on Polygon network. SGCoin balance will be 0.');
            return '0';
        }

        const contract = new ethers.Contract(SGCOIN_V1_CONTRACT_ADDRESS, ERC20_ABI, provider);
        const balance = await contract.balanceOf(address);
        const decimals = await contract.decimals();

        // Convert from wei to token amount string for precision
        return ethers.formatUnits(balance, decimals);
    } catch (error) {
        console.error('Error fetching SGCoin balance:', error);
        return '0';
    }
};

export const getSGCoinV2Balance = async (address: string, provider: ethers.Provider): Promise<string> => {
    try {
        const network = await provider.getNetwork();

        // Check if we're on Polygon
        if (Number(network.chainId) !== POLYGON_CHAIN_ID) {
            return '0';
        }

        const contract = new ethers.Contract(SGCOIN_V2_CONTRACT_ADDRESS, ERC20_ABI, provider);
        const balance = await contract.balanceOf(address);
        const decimals = await contract.decimals();

        // Convert from wei to token amount string
        return ethers.formatUnits(balance, decimals);
    } catch (error) {
        console.error('Error fetching SGCoin V2 balance:', error);
        return '0';
    }
};

export const getBurnedSGCoinV1 = async (provider: ethers.Provider): Promise<string> => {
    // Audit-verified fallback if live data fails
    const AUDITED_BURN = '1,777,161';

    try {
        const network = await provider.getNetwork();
        if (Number(network.chainId) !== POLYGON_CHAIN_ID) return AUDITED_BURN;

        const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';
        const contract = new ethers.Contract(SGCOIN_V1_CONTRACT_ADDRESS, ERC20_ABI, provider);

        const [migrationBurnBalance, deadAddressBalance, decimals] = await Promise.all([
            contract.balanceOf(SGCOIN_BURN_ADDRESS),
            contract.balanceOf(DEAD_ADDRESS),
            contract.decimals()
        ]);

        const totalBurned = migrationBurnBalance + deadAddressBalance;
        const formatted = ethers.formatUnits(totalBurned, decimals);

        // If we get a valid non-zero result, use it
        if (totalBurned > 0n) {
            return formatted;
        }

        return AUDITED_BURN;
    } catch (error) {
        console.error('Error fetching burned SGCoin:', error);
        return AUDITED_BURN;
    }
};

export const getNativeBalance = async (address: string, provider: ethers.Provider): Promise<string> => {
    try {
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
    } catch (error) {
        console.error('Error fetching native balance:', error);
        return '0';
    }
};

export const getLiquidityProviderV2Balance = async (provider: ethers.Provider): Promise<string> => {
    try {
        const contract = new ethers.Contract(SGCOIN_V2_CONTRACT_ADDRESS, ERC20_ABI, provider);
        const balance = await contract.balanceOf(SGCOIN_LIQUIDITY_PROVIDER);
        return ethers.formatUnits(balance, 18); // V2 is 18 decimals
    } catch (error) {
        console.error('Error fetching LP V2 balance:', error);
        return '0';
    }
};

export interface BurnActivity {
    type: 'burn' | 'migration';
    txHash: string;
    amount: string;
    timestamp?: number;
    address?: string;
    blockNumber?: number;
}

export const getRecentBurnActivity = async (provider: ethers.Provider): Promise<BurnActivity[]> => {
    try {
        // First try PolygonScan API for a richer history
        const apiActivities = await fetchBurnActivity(20);
        if (apiActivities.length > 0) return apiActivities;

        // Fallback to RPC method (limited to last 5000 blocks)
        const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';
        const v1Contract = new ethers.Contract(SGCOIN_V1_CONTRACT_ADDRESS, ERC20_ABI, provider);

        const currentBlock = await provider.getBlockNumber();
        const fromBlock = currentBlock - 5000;

        const filterDead = v1Contract.filters.Transfer(null, DEAD_ADDRESS);
        const filterBurn = v1Contract.filters.Transfer(null, SGCOIN_BURN_ADDRESS);

        const [eventsDead, eventsBurn] = await Promise.all([
            v1Contract.queryFilter(filterDead, fromBlock),
            v1Contract.queryFilter(filterBurn, fromBlock)
        ]);

        const activities: BurnActivity[] = [...eventsDead, ...eventsBurn].map((event: any) => ({
            type: event.args.to.toLowerCase() === SGCOIN_BURN_ADDRESS.toLowerCase() ? 'migration' : 'burn',
            txHash: event.transactionHash,
            amount: ethers.formatUnits(event.args.value, 9),
            address: event.args.from,
            blockNumber: event.blockNumber
        }));

        return activities.sort((a, b) => (b.blockNumber || 0) - (a.blockNumber || 0)).slice(0, 10);
    } catch (error) {
        console.error('Error fetching burn activity:', error);
        return [];
    }
};


export const checkNftOwnership = async (
    contractAddress: string,
    tokenId: string,
    walletAddress: string,
    existingProvider?: ethers.BrowserProvider
): Promise<boolean> => {
    try {
        if (!window.ethereum) return false;

        const provider = existingProvider || new ethers.BrowserProvider(window.ethereum);
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
    if (!window.ethereum) {
        alert("MetaMask is not installed. Please install it to use Web3 features.");
        return null;
    }

    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);

        if (accounts.length === 0) {
            console.warn("No accounts found.");
            return null;
        }

        const address = accounts[0];
        const balanceBigInt = await provider.getBalance(address);
        const balance = ethers.formatEther(balanceBigInt);
        const network = await provider.getNetwork();

        // Fetch SGCoin balances
        const [sgCoinBalance, v2Balance, totalMigrated] = await Promise.all([
            getSGCoinBalance(address, provider),
            getSGCoinV2Balance(address, provider),
            getBurnedSGCoinV1(provider)
        ]);

        return {
            address,
            balance,
            chainId: network.chainId.toString(),
            sgCoinBalance,
            v2Balance,
            totalMigratedV1: totalMigrated
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

export const getAllowance = async (tokenAddress: string, owner: string, spender: string, provider: ethers.Provider): Promise<bigint> => {
    try {
        const abi = ['function allowance(address owner, address spender) view returns (uint256)'];
        const contract = new ethers.Contract(tokenAddress, abi, provider);
        return await contract.allowance(owner, spender);
    } catch (error) {
        console.error('Error fetching allowance:', error);
        return 0n;
    }
};

export const approveTokens = async (tokenAddress: string, spender: string, amount: bigint, signer: ethers.Signer): Promise<string | null> => {
    try {
        const abi = ['function approve(address spender, uint256 amount) returns (bool)'];
        const contract = new ethers.Contract(tokenAddress, abi, signer);
        const tx = await contract.approve(spender, amount);
        await tx.wait();
        return tx.hash;
    } catch (error) {
        console.error('Error approving tokens:', error);
        return null;
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

const MINIWIZARD_ABI = [
    // ERC721 Enumerable
    'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
    'function balanceOf(address owner) view returns (uint256)',
    'function tokenURI(uint256 tokenId) view returns (string)'
];

export const fetchUserMiniWizards = async (ownerAddress: string, provider: ethers.Provider): Promise<any[]> => {
    try {
        const network = await provider.getNetwork();
        if (Number(network.chainId) !== POLYGON_CHAIN_ID) {
            console.warn('Not on Polygon network. Cannot fetch Mini Wizards.');
            return [];
        }

        const contract = new ethers.Contract(MINI_WIZARDS_CONTRACT_ADDRESS, MINIWIZARD_ABI, provider);

        const balance = await contract.balanceOf(ownerAddress);
        if (balance === 0n) return [];

        const wizardPromises = [];
        for (let i = 0; i < Number(balance); i++) {
            wizardPromises.push((async () => {
                try {
                    const tokenId = await contract.tokenOfOwnerByIndex(ownerAddress, i);
                    const tokenUri = await contract.tokenURI(tokenId);

                    // Fetch metadata from IPFS/URL
                    const httpUri = tokenUri.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/').replace('ipfs/ipfs/', 'ipfs/');
                    const metaRes = await fetch(httpUri);
                    if (!metaRes.ok) throw new Error('Metadata fetch failed');
                    const metadata = await metaRes.json();

                    return {
                        id: tokenId.toString(),
                        name: metadata.name || `Wizard #${tokenId}`,
                        image: metadata.image ? metadata.image.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/') : '',
                        attributes: metadata.attributes || [],
                        isLegacy: true,
                        level: 1, // Default for now
                        element: 'Unknown' // To be derived
                    };
                } catch (err) {
                    console.error('Error fetching wizard data:', err);
                    return null;
                }
            })());
        }

        const wizards = await Promise.all(wizardPromises);
        return wizards.filter(w => w !== null);

    } catch (error) {
        console.error("Error fetching Mini Wizards:", error);
        return [];
    }
};
