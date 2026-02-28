import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load env vars
dotenv.config();

const PRIVATE_KEY = process.env.PAYOUT_PRIVATE_KEY;
const RPC_URL = 'https://polygon-bor.publicnode.com';

const MIGRATOR_ADDRESS = '0xc6c1EB54E5Ed966C0B48154d6e22eaA8a4c4C536';
const NEW_PROVIDER = '0xd4d7691f062614ae6905d7bef62638b42c33df9f';

async function main() {
    if (!PRIVATE_KEY) {
        console.error('❌ Missing PAYOUT_PRIVATE_KEY in .env file');
        process.exit(1);
    }

    console.log('🔄 Updating SafeMigration Liquidity Provider...');

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const abi = [
        'function setLiquidityProvider(address _provider) external',
        'function liquidityProvider() view returns (address)',
        'function owner() view returns (address)'
    ];

    const contract = new ethers.Contract(MIGRATOR_ADDRESS, abi, wallet);

    try {
        const owner = await contract.owner();
        console.log(`Contract Owner: ${owner}`);
        console.log(`Our Wallet: ${wallet.address}`);

        if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error('❌ Error: Our wallet is NOT the contract owner.');
            process.exit(1);
        }

        const currentProvider = await contract.liquidityProvider();
        console.log(`Current Provider: ${currentProvider}`);

        if (currentProvider.toLowerCase() === NEW_PROVIDER.toLowerCase()) {
            console.log('✅ Provider is already correct.');
            return;
        }

        console.log(`Updating Provider to: ${NEW_PROVIDER}...`);
        const tx = await contract.setLiquidityProvider(NEW_PROVIDER);
        console.log(`⏳ Waiting for transaction: ${tx.hash}`);
        await tx.wait();

        const updatedProvider = await contract.liquidityProvider();
        console.log(`🎉 SUCCESS! New Provider: ${updatedProvider}`);

    } catch (error) {
        console.error('❌ Update failed:', error);
        process.exit(1);
    }
}

main().catch(console.error);
