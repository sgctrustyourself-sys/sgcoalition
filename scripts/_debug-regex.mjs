// Diagnostic: test readStringField against the actual first block from constants.ts
import fs from 'node:fs';

const constantsSource = fs.readFileSync('constants.ts', 'utf8');
const productsStart = constantsSource.indexOf('export const INITIAL_PRODUCTS');
const initializerStart = constantsSource.indexOf('=', productsStart);
const arrayStart = constantsSource.indexOf('[', initializerStart);

let depth = 0, arrayEnd = -1;
for (let i = arrayStart; i < constantsSource.length; i++) {
  if (constantsSource[i] === '[') depth++;
  if (constantsSource[i] === ']') { depth--; if (depth === 0) { arrayEnd = i; break; } }
}

function splitTopLevelObjects(src) {
  const objects = [];
  let start = -1, d = 0, q = '', esc = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (esc) esc = false;
      else if (c === '\') esc = true;
      else if (c === q) q = '';
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') { if (d === 0) start = i; d++; continue; }
    if (c === '}') { d--; if (d === 0 && start >= 0) { objects.push(src.slice(start, i + 1)); start = -1; } }
  }
  return objects;
}

const blocks = splitTopLevelObjects(constantsSource.slice(arrayStart + 1, arrayEnd));
console.log('Total blocks:', blocks.length);
if (blocks.length === 0) { console.log('No blocks!'); process.exit(1); }

console.log('');
console.log('=== First block (first 400 chars) ===');
console.log(blocks[0].slice(0, 400));
console.log('');

console.log('=== TEST 1: Read the actual file and extract the readStringField function ===');
const scriptContent = fs.readFileSync('scripts/generateSeoArtifacts.mjs', 'utf8');
const readStringMatch = scriptContent.match(/const readStringField = \([\s\S]*?
\};
/);
if (readStringMatch) {
  console.log('readStringField function from file:');
  console.log(readStringMatch[0]);
  console.log('');
  
  // Extract the template literal
  const tplMatch = readStringMatch[0].match(/new RegExp\(`([^`]+)`\)/);
  if (tplMatch) {
    console.log('Template literal raw:', JSON.stringify(tplMatch[1]));
    const compiledRegex = new RegExp(tplMatch[1]);
    console.log('Compiled regex source:', JSON.stringify(compiledRegex.source));
    console.log('');
    
    // Test it
    const field = 'id';
    const actualRegex = new RegExp(tplMatch[1].replace(/\$\{field\}/g, field));
    const result = blocks[0].match(actualRegex);
    console.log('Match result for field="id":', result ? `FOUND: "${result[2]}"` : 'NO MATCH');
  }
}
console.log('');

console.log('=== TEST 2: Check for backspace chars in the template literal ===');
if (readStringMatch) {
  const tplMatch = readStringMatch[0].match(/new RegExp\(`([^`]+)`\)/);
  if (tplMatch) {
    const tpl = tplMatch[1];
    const bsCount = (tpl.match(//g) || []).length;
    const backslashB = (tpl.match(/\b/g) || []).length;
    const singleBackslashB = (tpl.match(/(?<!\)b/g) || []).length;
    console.log('Backspace (0x08) count in template:', bsCount);
    console.log('Double-backslash-b (\b) count:', backslashB);
    console.log('Single b count (not preceded by backslash):', singleBackslashB);
    console.log('Template has literal backspace?:', bsCount > 0);
  }
}
console.log('');

console.log('=== TEST 3: Try with String.raw to fix the backspace issue ===');
const field = 'id';
const rawRegex = new RegExp(String.raw`['"]?${field}['"]?\s*:\s*(['"\`])` + String.raw`([\s\S]*?)`);
console.log('String.raw regex source:', JSON.stringify(rawRegex.source));
const rawResult = blocks[0].match(rawRegex);
console.log('Match result:', rawResult ? `FOUND: "${rawResult[2]}"` : 'NO MATCH');
console.log('');

console.log('=== TEST 4: Check the actual first block for "id" ===');
console.log('Contains "id":', blocks[0].includes('id'));
console.log('Contains "\\"id\\"":', blocks[0].includes('"id"'));
console.log('First 80 chars hex:', Buffer.from(blocks[0].slice(0, 80)).toString('hex'));
