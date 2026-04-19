/**
 * Compile + upload ATtiny1616 sketch using arduino-cli (Upload Using Programmer).
 *
 * Prereqs: arduino-cli on PATH, megaTinyCore installed, firmware.config.json filled.
 *
 * Usage:
 *   node tools/firmware-flasher/flash.mjs              # prepare from config + compile + upload (needs colour args - see below)
 *
 * Typical flow:
 *   node tools/firmware-flasher/prepare-sketch.mjs --name "Deep Red"
 *   node tools/firmware-flasher/flash.mjs
 *
 * Or one-liner (shell):
 *   node tools/firmware-flasher/prepare-sketch.mjs --id 145 && node tools/firmware-flasher/flash.mjs
 */
import { spawnSync } from 'child_process';
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

  run('arduino-cli', ['compile', '--fqbn', fqbn, sketchDir]);
  run('arduino-cli', ['upload', '-p', port, '--fqbn', fqbn, '--programmer', programmer, sketchDir]);
  console.log('\nDone.');
}

main();
