const fs = require('fs');
const path = require('path');

const CONSTANTS_PATH = path.join(__dirname, '../../constants.ts');
const BOT_INDEX_PATH = path.join(__dirname, 'index.js');
const BOT_DEPLOY_PATH = path.join(__dirname, 'deploy-commands.js');

function sync() {
    console.log('🔄 Starting Product Sync...');

    if (!fs.existsSync(CONSTANTS_PATH)) {
        console.error('❌ Could not find constants.ts at', CONSTANTS_PATH);
        return;
    }

    const constantsContent = fs.readFileSync(CONSTANTS_PATH, 'utf8');

    // Extract INITIAL_PRODUCTS array using regex
    // This is a simple parser for the structure in constants.ts
    const productsMatch = constantsContent.match(/export const INITIAL_PRODUCTS: Product\[\] = (\[[\s\S]*?\]);/);

    if (!productsMatch) {
        console.error('❌ Could not find INITIAL_PRODUCTS in constants.ts');
        return;
    }

    // Clean up the match to make it valid JSON-ish or just parse fields
    const productsRaw = productsMatch[1];

    // We'll parse IDs, Names, Prices, and Descriptions manually to avoid eval/ts-node dependencies
    const productBlocks = productsRaw.match(/\{[\s\S]*?\}/g);
    const products = productBlocks.map(block => {
        const id = block.match(/id: '(.*?)'/)?.[1];
        const name = block.match(/name: '(.*?)'/)?.[1];
        const price = block.match(/price: (\d+)/)?.[1];
        const desc = block.match(/description: '(.*?)'/)?.[1];
        const imagesMatch = block.match(/images: \[(.*?)\]/);
        let imageUrl = 'https://sgcoalition.xyz/images/logo.png';
        if (imagesMatch) {
            const firstImage = imagesMatch[1].split(',')[0].trim().replace(/['"]/g, '');
            imageUrl = firstImage.startsWith('http') ? firstImage : `https://sgcoalition.xyz${firstImage}`;
        }

        return {
            id,
            name,
            price: parseInt(price),
            description: desc,
            image: imageUrl,
            status: block.includes('isLimitedEdition: true') ? 'LIMITED EDITION' : 'ACTIVE'
        };
    });

    console.log(`✅ Extracted ${products.length} products:`, products.map(p => p.name).join(', '));

    // 1. Update index.js
    let indexContent = fs.readFileSync(BOT_INDEX_PATH, 'utf8');

    // Update choices
    const choicesStr = products.map(p => `                    { name: '${p.name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}', value: '${p.id}' },`).join('\n');
    indexContent = indexContent.replace(/(choices: \[)[\s\S]*?(\],)/, `$1\n${choicesStr}\n$2`);

    // Update PRODUCTS object
    const productsObjStr = `const PRODUCTS = {\n${products.map(p => `    ${p.id}: {
        name: '${p.name}',
        price: ${p.price},
        category: '${p.id.includes('nft') ? 'APPAREL / NFT-INTEGRATED' : 'ACCESSORY / TACTICAL'}',
        description: '${p.description.replace(/'/g, "\\'")}',
        url: 'https://sgcoalition.xyz/products#/shop',
        image: '${p.image}',
        status: '${p.status}'
    }`).join(',\n')}\n};`;

    indexContent = indexContent.replace(/const PRODUCTS = \{[\s\S]*?\};/, productsObjStr);
    fs.writeFileSync(BOT_INDEX_PATH, indexContent);
    console.log('✅ Updated index.js');

    // 2. Update deploy-commands.js
    let deployContent = fs.readFileSync(BOT_DEPLOY_PATH, 'utf8');
    deployContent = deployContent.replace(/(choices: \[)[\s\S]*?(\],)/, `$1\n${choicesStr}\n$2`);
    fs.writeFileSync(BOT_DEPLOY_PATH, deployContent);
    console.log('✅ Updated deploy-commands.js');

    console.log('🎉 Sync Complete! Run "npm run deploy" to update slash commands in Discord.');
}

sync();
