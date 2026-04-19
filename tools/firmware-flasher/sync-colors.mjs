/**
 * Regenerates colors.json from src/data/popupColorCatalog.ts (single source of truth).
 * Run: node tools/firmware-flasher/sync-colors.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..');
const catalogPath = path.join(root, 'src', 'data', 'popupColorCatalog.ts');
const outPath = path.join(__dirname, 'colors.json');

const text = fs.readFileSync(catalogPath, 'utf8');
const re = /\[(\d+),\s*'([^']+)',\s*(\d+),\s*(\d+),\s*(\d+)\]/g;
const colors = [];
let m;
while ((m = re.exec(text)) !== null) {
  colors.push({
    id: Number(m[1]),
    name: m[2],
    r: Number(m[3]),
    g: Number(m[4]),
    b: Number(m[5]),
  });
}

if (colors.length === 0) {
  console.error('No colors parsed from popupColorCatalog.ts');
  process.exit(1);
}

fs.writeFileSync(outPath, JSON.stringify(colors, null, 2));
console.log(`Wrote ${colors.length} colors to ${path.relative(root, outPath)}`);
