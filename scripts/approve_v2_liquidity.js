import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const PRIVATE_KEY = process.env.PAYOUT_PRIVATE_KEY;
const RPC_URL = 'https://polygon-bor.publicnode.com';

const V2_ADDRESS = '0xd53e417107d0e01bbe74a704bb90fe7a6916ee1e';
const MIGRATOR_ADDRESS = '0x36cD03A7089937e6814faa11A1C44188a6ef634C';

// 10 Million with 18 decimals
const APPROVAL_AMOUNT = '10000000000000000000000000';

async function main() {
    if (!PRIVATE_KEY) {
        console.error('❌ Missing PAYOUT_PRIVATE_KEY');
        process.exit(1);
    }

    // Connect to Polygon
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`🚀 Approving Liquidity from: ${wallet.address}`);
    console.log(`   Contract: ${MIGRATOR_ADDRESS}`);

    const abi = ['function approve(address spender, uint256 amount) public returns (bool)'];
    const v2Token = new ethers.Contract(V2_ADDRESS, abi, wallet);

    console.log('⏳ Sending Approve Transaction...');
    const tx = await v2Token.approve(MIGRATOR_ADDRESS, APPROVAL_AMOUNT);
    console.log(`   Tx Hash sent, waiting for confirmation...`);

    await tx.wait();
    console.log('✅ Approval Confirmed! Migration is now active.');
}

main().catch((error) => {
    console.error('❌ Approval failed:', error);
    process.exit(1);
});
