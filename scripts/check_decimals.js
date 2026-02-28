import { ethers } from 'ethers';

const RPC_URL = 'https://polygon-bor.publicnode.com';
const V1_ADDRESS = '0x951806a2581c22C478aC613a675e6c898E2aBe21';

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const abi = ['function decimals() view returns (uint8)'];
    const contract = new ethers.Contract(V1_ADDRESS, abi, provider);

    console.log('Fetching V1 Decimals...');
    const decimals = await contract.decimals();
    console.log(`V1 Decimals: ${decimals}`);
}

main().catch(console.error);
