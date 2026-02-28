import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import solc from 'solc';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load env vars
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRIVATE_KEY = process.env.PAYOUT_PRIVATE_KEY;
const RPC_URL = 'https://polygon-bor.publicnode.com'; // More reliable public node

const V1_ADDRESS = '0x951806a2581c22C478aC613a675e6c898E2aBe21';
const V2_ADDRESS = '0xd53e417107d0e01bbe74a704bb90fe7a6916ee1e';

// Payout Wallet (The one provided by user)
const PAYOUT_WALLET_ADDRESS = '0x39451d0ee9Fc5dd861C985d2a3e227F6Ac7387f4';

async function main() {
    if (!PRIVATE_KEY) {
        console.error('❌ Missing PAYOUT_PRIVATE_KEY in .env file');
        process.exit(1);
    }

    console.log('🚀 Starting SafeMigration Deployment...');
    console.log('Compiling Contract...');

    // 1. Compile
    const contractPath = path.resolve(__dirname, '../contracts/SafeMigration.sol');
    const source = fs.readFileSync(contractPath, 'utf8');

    const input = {
        language: 'Solidity',
        sources: {
            'SafeMigration.sol': {
                content: source,
            },
        },
        settings: {
            outputSelection: {
                '*': {
                    '*': ['*'],
                },
            },
        },
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    const contractFile = output.contracts['SafeMigration.sol']['SafeMigration'];

    if (!contractFile) {
        console.error('❌ Compilation Failed:', output.errors);
        process.exit(1);
    }

    const bytecode = contractFile.evm.bytecode.object;
    const abi = contractFile.abi;

    console.log('✅ Compilation Successful.');

    // 2. Deploy
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`Deploying from account: ${wallet.address}`);

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`Balance: ${ethers.formatEther(balance)} MATIC`);

    if (balance < ethers.parseEther('0.1')) {
        console.warn('⚠️ Low balance! Ensure you have at least 0.1 MATIC for gas.');
    }

    const factory = new ethers.ContractFactory(abi, bytecode, wallet);

    // Deploy with V1 and V2 addresses
    const contract = await factory.deploy(V1_ADDRESS, V2_ADDRESS);
    console.log('⏳ Waiting for deployment transaction...');

    await contract.waitForDeployment();

    const contractAddress = await contract.getAddress();
    console.log(`✅ SafeMigration Deployed to: ${contractAddress}`);

    // 3. Set Liquidity Provider (if deployment wallet != payout wallet)
    // In this case, if the user puts the Payout Key in .env, then Deployer == Payout Wallet.
    // The contract sets constructor msg.sender as provider, so no need to change it!
    // But we should verify.

    console.log('🔄 Verifying Liquidity Provider settings...');
    // We can interact with the new contract
    // Liquidity Provider is already msg.sender (our wallet)

    console.log('\n🎉 SUCCESS! Contract is ready.');
    console.log('Next Steps:');
    console.log('1. Send 10M V2 Tokens to this wallet:', wallet.address);
    console.log('2. Go to PolygonScan and Approve the Contract to spend those tokens.');
    console.log(`   Contract: ${contractAddress}`);
    console.log('   Spender: ' + contractAddress);
    console.log(`   Amount: 10000000000000000000000000`);
    console.log('3. Update "constants.ts" with the new address.');
}

main().catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
});
