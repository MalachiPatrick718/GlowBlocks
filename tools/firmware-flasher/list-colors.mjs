/**
 * List colours (optional filter).
 *   node tools/firmware-flasher/list-colors.mjs
 *   node tools/firmware-flasher/list-colors.mjs ocean
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const colorsPath = path.join(__dirname, 'colors.json');
if (!fs.existsSync(colorsPath)) {
  console.error('Run: node tools/firmware-flasher/sync-colors.mjs');
  process.exit(1);
}
const colors = JSON.parse(fs.readFileSync(colorsPath, 'utf8'));
const q = (process.argv[2] || '').trim().toLowerCase();
const rows = q
  ? colors.filter((c) => `${c.id} ${c.name}`.toLowerCase().includes(q))
  : colors;
for (const c of rows) {
  console.log(`${String(c.id).padStart(3)}  ${c.name.padEnd(22)}  ${c.r}, ${c.g}, ${c.b}`);
}
