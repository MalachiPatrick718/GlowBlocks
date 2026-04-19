/**
 * Writes GlowBlocksFirmware_v3.ino into your sketch folder with COLOUR_R/G/B set.
 *
 * Usage:
 *   node tools/firmware-flasher/prepare-sketch.mjs --name "Deep Red"
 *   node tools/firmware-flasher/prepare-sketch.mjs --id 41
 *   node tools/firmware-flasher/prepare-sketch.mjs --rgb 255,80,0
 *
 * Requires tools/firmware-flasher/firmware.config.json (copy from .example.json)
 * with "sketchDir" pointing at the folder that will contain GlowBlocksFirmware_v3.ino
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadConfig() {
  // Check GUI config location first (~/.glowblocks/firmware.config.json)
  const homeConfigPath = path.join(os.homedir(), '.glowblocks', 'firmware.config.json');
  if (fs.existsSync(homeConfigPath)) {
    return JSON.parse(fs.readFileSync(homeConfigPath, 'utf8'));
  }

  // Fall back to local config (for CLI usage)
  const configPath = path.join(__dirname, 'firmware.config.json');
  if (!fs.existsSync(configPath)) {
    console.error(`Missing ${configPath}\nCopy firmware.config.example.json → firmware.config.json and edit.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function loadColors() {
  const colorsPath = path.join(__dirname, 'colors.json');
  if (!fs.existsSync(colorsPath)) {
    console.error('Missing colors.json. Run: node tools/firmware-flasher/sync-colors.mjs');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(colorsPath, 'utf8'));
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--name' && argv[i + 1]) out.name = argv[++i];
    else if (argv[i] === '--id' && argv[i + 1]) out.id = Number(argv[++i]);
    else if (argv[i] === '--rgb' && argv[i + 1]) out.rgb = argv[++i];
    else if (argv[i] === '--brightness' && argv[i + 1]) out.brightness = Number(argv[++i]);
  }
  return out;
}

function resolveRgb(colors, { name, id, rgb }) {
  if (rgb) {
    const parts = rgb.split(/[,\s]+/).map((n) => Number(n.trim())).filter((n) => !Number.isNaN(n));
    if (parts.length !== 3) {
      throw new Error(`--rgb must be three numbers, e.g. 255,80,0 (got ${rgb})`);
    }
    return { r: parts[0], g: parts[1], b: parts[2], label: `RGB(${parts.join(',')})` };
  }
  if (Number.isInteger(id)) {
    const row = colors.find((c) => c.id === id);
    if (!row) throw new Error(`No color with id ${id}`);
    return { r: row.r, g: row.g, b: row.b, label: `#${row.id} ${row.name}` };
  }
  if (name) {
    const q = name.trim().toLowerCase();
    const exact = colors.find((c) => c.name.toLowerCase() === q);
    if (exact) return { r: exact.r, g: exact.g, b: exact.b, label: `${exact.name} (#${exact.id})` };
    const partial = colors.filter((c) => c.name.toLowerCase().includes(q));
    if (partial.length === 1) {
      const c = partial[0];
      return { r: c.r, g: c.g, b: c.b, label: `${c.name} (#${c.id})` };
    }
    if (partial.length > 1) {
      throw new Error(
        `Ambiguous name "${name}". Matches:\n${partial.slice(0, 15).map((c) => `  #${c.id} ${c.name}`).join('\n')}${partial.length > 15 ? '\n  ...' : ''}`
      );
    }
    throw new Error(`No color matching name "${name}"`);
  }
  throw new Error('Provide one of: --name "Colour Name" | --id 41 | --rgb 255,80,0');
}

function main() {
  const args = parseArgs();
  const config = loadConfig();
  const sketchDir = config.sketchDir;
  if (!sketchDir || !fs.existsSync(sketchDir)) {
    console.error(`Invalid sketchDir in firmware.config.json: ${sketchDir}`);
    process.exit(1);
  }

  const colors = loadColors();
  const { r, g, b, label } = resolveRgb(colors, args);

  // Handle brightness (default 200 if not specified)
  const brightness = args.brightness !== undefined ? args.brightness : 200;
  if (brightness < 0 || brightness > 255) {
    console.error('Brightness must be between 0 and 255');
    process.exit(1);
  }

  const templatePath = path.join(__dirname, 'GlowBlocksFirmware_v3.template.ino');
  let ino = fs.readFileSync(templatePath, 'utf8');
  ino = ino.replace(/__COLOUR_R__/g, String(r));
  ino = ino.replace(/__COLOUR_G__/g, String(g));
  ino = ino.replace(/__COLOUR_B__/g, String(b));
  ino = ino.replace(/__BRIGHTNESS__/g, String(brightness));

  const outIno = path.join(sketchDir, 'GlowBlocksFirmware_v3.ino');
  fs.writeFileSync(outIno, ino);
  console.log(`Wrote ${outIno}`);
  console.log(`Colour: ${label} → R=${r} G=${g} B=${b}`);
  console.log(`Brightness: ${brightness}`);
}

main();
