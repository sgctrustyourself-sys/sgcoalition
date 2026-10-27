// Temporary debug script - tests readStringField regex against actual constants.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const readStringField = (block, field) => {
  const match = block.match(new RegExp(`['\"]?${field}['\"]?\s*:\s*(['\"\\`])([\s\S]*?)\1`));
  return match ? match[2] : '(NO MATCH)';
};

const readNumberField = (block, field) => {
  const match = block.match(new RegExp(`['\"]?${field}['\"]?\s*:\s*([0-9]+(?:\.[0-9]+)?)`));
  return match ? Number(match[1]) : '(NO MATCH)';
};

const source = fs.readFileSync(path.join(ROOT, 'constants.ts'), 'utf8');
const productsStart = source.indexOf('export const INITIAL_PRODUCTS');
const initializerStart = source.indexOf('=', productsStart);
const arrayStart = source.indexOf('[', initializerStart);

let depth = 0;
let arrayEnd = -1;
for (let i = arrayStart; i < source.length; i++) {
  if (source[i] === '[') depth++;
  if (source[i] === ']') {
    depth--;
    if (depth === 0) { arrayEnd = i; break; }
  }
}

const arrayBody = source.slice(arrayStart + 1, arrayEnd);

let objStart = -1;
let objDepth = 0;
let objEnd = -1;
let inStr = '';
let escape = false;
for (let i = 0; i < arrayBody.length; i++) {
  const ch = arrayBody[i];
  if (inStr) {
    if (escape) { escape = false; continue; }
    if (ch === '\') { escape = true; continue; }
    if (ch === inStr) inStr = '';
    continue;
  }
  if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
  if (ch === '{') { if (objDepth === 0) objStart = i; objDepth++; }
  if (ch === '}') { objDepth--; if (objDepth === 0) { objEnd = i; break; } }
}

const firstBlock = arrayBody.slice(objStart, objEnd + 1);

console.log('=== First product block (first 500 chars) ===');
console.log(firstBlock.slice(0, 500));
console.log('');
console.log('=== readStringField results ===');
console.log('  id:    ', JSON.stringify(readStringField(firstBlock, 'id')));
console.log('  name:  ', JSON.stringify(readStringField(firstBlock, 'name')));
console.log('  price: ', JSON.stringify(readNumberField(firstBlock, 'price')));
console.log('  category:', JSON.stringify(readStringField(firstBlock, 'category')));
console.log('');
console.log('=== Raw regex test ===');
const re = new RegExp(`['\"]?id['\"]?\s*:\s*(['\"\\`])([\s\S]*?)\1`);
const m = firstBlock.match(re);
console.log('  regex:', re.toString());
console.log('  match:', m ? 'FOUND, group 2 = ' + JSON.stringify(m[2]) : 'NO MATCH');
