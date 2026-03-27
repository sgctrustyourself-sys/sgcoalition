import { ethers } from 'ethers';
import {
    POLYGON_CHAIN_ID,
    SGCOIN_BURN_ADDRESS,
    SGCOIN_V1_CONTRACT_ADDRESS,
    SGCOIN_V2_CONTRACT_ADDRESS,
    POLYGON_RPC_URL
} from '../constants';

const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
];

const AUDITED_BURN = '1,777,161';

export interface WalletBalanceSnapshot {
    sgCoinBalance: number;
    v2Balance: number;
    totalMigrated: number;
}

const createPolygonProvider = () =>
    new ethers.JsonRpcProvider(
        POLYGON_RPC_URL,
        { chainId: 137, name: 'polygon' },
        { staticNetwork: true }
    );

export const getSGCoinBalance = async (address: string, provider: ethers.Provider): Promise<string> => {
    try {
        const network = await provider.getNetwork();

        if (Number(network.chainId) !== POLYGON_CHAIN_ID) {
            return '0';
        }

        const contract = new ethers.Contract(SGCOIN_V1_CONTRACT_ADDRESS, ERC20_ABI, provider);
        const balance = await contract.balanceOf(address);
        const decimals = await contract.decimals();

        return ethers.formatUnits(balance, decimals);
    } catch (error) {
        console.error('Error fetching SGCoin balance:', error);
        return '0';
    }
};

export const getSGCoinV2Balance = async (address: string, provider: ethers.Provider): Promise<string> => {
    try {
        const network = await provider.getNetwork();

        if (Number(network.chainId) !== POLYGON_CHAIN_ID) {
            return '0';
        }

        const contract = new ethers.Contract(SGCOIN_V2_CONTRACT_ADDRESS, ERC20_ABI, provider);
        const balance = await contract.balanceOf(address);
        const decimals = await contract.decimals();

        return ethers.formatUnits(balance, decimals);
    } catch (error) {
        console.error('Error fetching SGCoin V2 balance:', error);
        return '0';
    }
};

export const getBurnedSGCoinV1 = async (provider: ethers.Provider): Promise<string> => {
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

        if (totalBurned > 0n) {
            return formatted;
        }

        return AUDITED_BURN;
    } catch (error) {
        console.error('Error fetching burned SGCoin:', error);
        return AUDITED_BURN;
    }
};

export const fetchWalletBalanceSnapshot = async (address: string): Promise<WalletBalanceSnapshot> => {
    const provider = createPolygonProvider();

    const [v1, v2, burned] = await Promise.all([
        getSGCoinBalance(address, provider).catch(() => '0'),
        getSGCoinV2Balance(address, provider).catch(() => '0'),
        getBurnedSGCoinV1(provider).catch(() => AUDITED_BURN)
    ]);

    return {
        sgCoinBalance: parseFloat(v1) || 0,
        v2Balance: parseFloat(v2) || 0,
        totalMigrated: parseFloat((burned || AUDITED_BURN).replace(/,/g, '')) || 0,
    };
};
