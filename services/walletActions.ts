import { ethers } from 'ethers';
import { fetchWalletBalanceSnapshot } from './walletBalances';

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

export const formatAddress = (address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const connectWallet = async (): Promise<WalletData | null> => {
    if (!window.ethereum) {
        alert('MetaMask is not installed. Please install it to use Web3 features.');
        return null;
    }

    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);

        if (accounts.length === 0) {
            console.warn('No accounts found.');
            return null;
        }

        const address = accounts[0];
        const balanceBigInt = await provider.getBalance(address);
        const balance = ethers.formatEther(balanceBigInt);
        const network = await provider.getNetwork();
        const balances = await fetchWalletBalanceSnapshot(address);

        return {
            address,
            balance,
            chainId: network.chainId.toString(),
            sgCoinBalance: balances.sgCoinBalance.toString(),
            v2Balance: balances.v2Balance.toString(),
            totalMigratedV1: balances.totalMigrated.toString()
        };
    } catch (error: any) {
        if (error.code === 4001) {
            console.log('User rejected the connection request.');
        } else {
            console.error('Error connecting wallet:', error);
        }
        return null;
    }
};

export const switchToPolygon = async (): Promise<boolean> => {
    if (!window.ethereum) return false;

    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x89' }],
        });
        return true;
    } catch (switchError: any) {
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
