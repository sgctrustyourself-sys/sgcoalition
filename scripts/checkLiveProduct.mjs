import { chromium } from 'playwright';

const url = 'https://sgcoalition.xyz/product/Coalition_Grey_Wave_Wallet_2_2';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

const text = await page.innerText('body');
await page.screenshot({ path: 'pdp-grey-wave-2-2-live.png', fullPage: true });

const checks = {
    hasGreyWave: text.includes('Grey Wave'),
    has85: /\$85/.test(text) || /85\.00/.test(text),
    hasSold: /sold/i.test(text) || /archived/i.test(text),
    priceMention: (text.match(/\$[0-9]+(?:\.[0-9]{2})?/) || [])[0],
};

console.log(JSON.stringify(checks, null, 2));

await browser.close();
