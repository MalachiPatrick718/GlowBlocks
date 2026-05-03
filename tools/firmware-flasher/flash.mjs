/**
 * Compile + upload ATtiny1616 sketch.
 *
 * Compile: uses arduino-cli
 * Upload:  uses avrdude 6.3 directly (megaTinyCore's avrdude.conf is incompatible with avrdude 8.0)
 *
 * Prereqs: arduino-cli on PATH, megaTinyCore installed, firmware.config.json filled.
 *
 * Usage:
 *   node tools/firmware-flasher/flash.mjs
 *
 * Typical flow:
 *   node tools/firmware-flasher/prepare-sketch.mjs --name "Deep Red"
 *   node tools/firmware-flasher/flash.mjs
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// avrdude 6.3 bundled with DxCore (compatible with megaTinyCore's avrdude.conf)
const AVRDUDE_PATH = path.join(
  os.homedir(),
  'Library/Arduino15/packages/DxCore/tools/avrdude/6.3.0-arduino17or18/bin/avrdude'
);
const AVRDUDE_CONF = path.join(
  os.homedir(),
  'Library/Arduino15/packages/megaTinyCore/hardware/megaavr/2.6.11/avrdude.conf'
);

function loadConfig() {
  const homeConfigPath = path.join(os.homedir(), '.glowblocks', 'firmware.config.json');
  if (fs.existsSync(homeConfigPath)) {
    return JSON.parse(fs.readFileSync(homeConfigPath, 'utf8'));
  }

  const configPath = path.join(__dirname, 'firmware.config.json');
  if (!fs.existsSync(configPath)) {
    console.error(`Missing ${configPath}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function run(cmd, args, opts = {}) {
  console.log(`\n$ ${cmd} ${args.join(' ')}\n`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false, ...opts });
  if (r.error) {
    console.error(r.error.message);
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status || 1);
}

function findHexFile(sketchDir, fqbn) {
  // arduino-cli puts build output in a cache dir, but we can ask it
  const r = spawnSync('arduino-cli', ['compile', '--fqbn', fqbn, '--show-properties', sketchDir], {
    encoding: 'utf8',
    shell: false,
  });
  // Try the standard build path
  const buildPath = path.join(sketchDir, 'build');

  // Use arduino-cli compile with --export-binaries to get hex in sketch dir
  return null; // Will use --export-binaries approach instead
}

function main() {
  const config = loadConfig();
  const { sketchDir, fqbn, port, programmer } = config;
  if (!sketchDir || !fqbn || !port || !programmer) {
    console.error('firmware.config.json must include sketchDir, fqbn, port, programmer');
    process.exit(1);
  }
  const inoPath = path.join(sketchDir, 'GlowBlocksFirmware_v3.ino');
  if (!fs.existsSync(inoPath)) {
    console.error(`Missing sketch: ${inoPath}\nRun prepare-sketch.mjs first.`);
    process.exit(1);
  }

  // Compile and export hex to sketch directory
  run('arduino-cli', ['compile', '--fqbn', fqbn, '--export-binaries', sketchDir]);

  // Find the compiled hex file
  const buildDir = path.join(sketchDir, 'build');
  let hexFile = null;
  if (fs.existsSync(buildDir)) {
    const findHex = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const found = findHex(full);
          if (found) return found;
        } else if (entry.name.endsWith('.hex') && !entry.name.includes('bootloader')) {
          return full;
        }
      }
      return null;
    };
    hexFile = findHex(buildDir);
  }

  if (!hexFile) {
    console.error('Could not find compiled .hex file in build directory');
    process.exit(1);
  }
  console.log(`\nFound hex: ${hexFile}`);

  // Extract MCU from FQBN (e.g., chip=1616 → attiny1616)
  const chipMatch = fqbn.match(/chip=(\d+)/);
  const mcu = chipMatch ? `attiny${chipMatch[1]}` : 'attiny1616';

  // Upload using avrdude 6.3 directly
  if (fs.existsSync(AVRDUDE_PATH)) {
    console.log('Using avrdude 6.3 for upload...');
    run(AVRDUDE_PATH, [
      `-C${AVRDUDE_CONF}`,
      `-p${mcu}`,
      `-c${programmer}`,
      `-P${port}`,
      `-b115200`,
      `-Uflash:w:${hexFile}:i`,
    ]);
  } else {
    // Fallback to arduino-cli upload
    console.log('avrdude 6.3 not found, falling back to arduino-cli upload...');
    run('arduino-cli', ['upload', '-p', port, '--fqbn', fqbn, '--programmer', programmer, sketchDir]);
  }

  console.log('\nDone.');
}

main();
