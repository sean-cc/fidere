import fs from 'node:fs';

let text = '';
try {
  text = fs.readFileSync('out/result.txt', 'utf8');
} catch {
  console.error('out/result.txt is missing');
  process.exit(1);
}
if (text.trim() !== 'ok') {
  console.error(`expected the word ok, got: ${JSON.stringify(text.slice(0, 80))}`);
  process.exit(1);
}
console.log('verified: out/result.txt is ok');
