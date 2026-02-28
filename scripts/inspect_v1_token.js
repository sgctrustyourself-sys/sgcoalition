import { ethers } from 'ethers';

const RPC_URL = 'https://polygon-bor.publicnode.com';
const V1_ADDRESS = '0x951806a2581c22C478aC613a675e6c898E2aBe21';

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Check for common fee variables
    const abi = [
        'function _taxFee() view returns (uint256)',
        'function _liquidityFee() view returns (uint256)',
        'function _burnFee() view returns (uint256)',
        'function totalFees() view returns (uint256)',
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)'
    ];

    const contract = new ethers.Contract(V1_ADDRESS, abi, provider);

    console.log(`Inspecting V1 Token: ${V1_ADDRESS}`);

    try { console.log(`Name: ${await contract.name()}`); } catch (e) { console.log('No name()'); }
    try { console.log(`Symbol: ${await contract.symbol()}`); } catch (e) { console.log('No symbol()'); }
    try { console.log(`Decimals: ${await contract.decimals()}`); } catch (e) { console.log('No decimals()'); }
    try { console.log(`Tax Fee: ${await contract._taxFee()}`); } catch (e) { console.log('No _taxFee()'); }
    try { console.log(`Liquidity Fee: ${await contract._liquidityFee()}`); } catch (e) { console.log('No _liquidityFee()'); }
    try { console.log(`Total Fees: ${await contract.totalFees()}`); } catch (e) { console.log('No totalFees()'); }
}

main().catch(console.error);
