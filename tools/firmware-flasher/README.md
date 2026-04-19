# GlowBlocks firmware flasher (ATtiny1616 + ESP32 UPDI)

This folder helps you **set LED colour by name or ID** (same 200 colours as the website), **patch the sketch**, then **compile and upload** with `arduino-cli` — the same flow as **Arduino IDE → Upload Using Programmer**.

## What you get

| Script | Purpose |
|--------|---------|
| `sync-colors.mjs` | Regenerates `colors.json` from `src/data/popupColorCatalog.ts` |
| `list-colors.mjs` | Prints all colours (optional filter: `node list-colors.mjs deep`) |
| `prepare-sketch.mjs` | Writes `GlowBlocksFirmware_v3.ino` into **your** sketch folder with `COLOUR_R/G/B` |
| `flash.mjs` | Runs `arduino-cli compile` + `arduino-cli upload` with **programmer** |

## One-time setup

### 1) Install Arduino CLI

- macOS (Homebrew): `brew install arduino-cli`
- Or: https://docs.arduino.cc/arduino-cli/

### 2) Install megaTinyCore

```bash
arduino-cli config init
arduino-cli core update-index --additional-urls https://raw.githubusercontent.com/SpenceKonde/megaTinyCore/master/package_megaTinyCore_index.json
arduino-cli core install megaTinyCore:megaavr
```

### 2b) Install sketch libraries (once)

```bash
arduino-cli lib install "Adafruit NeoPixel"
```

### 3) Get FQBN, port, and programmer ID from Arduino IDE

1. Open Arduino IDE with the same board / menus you already use for **ATtiny1616**.
2. **File → Preferences** → enable **verbose output during: upload**.
3. Run **Sketch → Upload Using Programmer** once.
4. In the console, find:
   - **FQBN** (full board string, e.g. `megaTinyCore:megaavr:atxy6:chip=1616,...`)
   - **Serial port** of your ESP32 (e.g. `/dev/cu.usbserial-*` on Mac)
   - **Programmer** id (whatever appears with `--programmer` or in the upload line)

Copy those into `firmware.config.json`.

### 4) Sketch folder layout

Arduino expects a folder whose name matches the `.ino` file:

```text
/path/to/GlowBlocksFirmware_v3/
  GlowBlocksFirmware_v3.ino   ← prepare-sketch.mjs writes this file
```

Create that folder once, point `sketchDir` in `firmware.config.json` at it.

### 5) Config file

```bash
cd tools/firmware-flasher
cp firmware.config.example.json firmware.config.json
# Edit firmware.config.json — use absolute path for sketchDir
```

`firmware.config.json` is **gitignored** (example only is committed).

### 6) Sync colours from the website catalog

From repo root:

```bash
node tools/firmware-flasher/sync-colors.mjs
```

## Every flash (typical)

```bash
# Pick colour by name (matches popup catalog, fuzzy if unique)
node tools/firmware-flasher/prepare-sketch.mjs --name "Deep Red"

# Or by catalogue id
node tools/firmware-flasher/prepare-sketch.mjs --id 145

# Or raw RGB
node tools/firmware-flasher/prepare-sketch.mjs --rgb 255,80,0

# Then compile + upload (ESP32 connected, Tiny wired for UPDI)
node tools/firmware-flasher/flash.mjs
```

List colours:

```bash
node tools/firmware-flasher/list-colors.mjs
node tools/firmware-flasher/list-colors.mjs ocean
```

## npm shortcuts (from repo root)

```bash
npm run firmware:sync-colors
npm run firmware:list -- ocean
npm run firmware:prepare -- --name "Deep Red"
npm run firmware:flash
```

## GUI Desktop App

A full-featured **Electron desktop app** is available in `firmware-flasher-gui/` for easier firmware flashing.

### Features

- 🎨 **Searchable color picker** - Browse all 200 colors by name or ID
- ⚙️ **Configuration editor** - Visual setup for FQBN, port, and programmer
- 🔍 **Auto-detection** - Automatically detect connected ESP32 serial ports
- 📊 **Live console output** - See compilation and upload progress in real-time
- 💾 **Color preview** - Visual preview of selected RGB colors

### Quick Start (GUI)

1. **Install dependencies** (one-time):
   ```bash
   cd tools/firmware-flasher-gui
   npm install
   ```

2. **Launch the app**:
   ```bash
   npm start
   ```

3. **First-time setup in GUI**:
   - Click "Browse..." to select your sketch directory
   - Click "Auto-detect" to find your ESP32 port (or enter manually)
   - Enter FQBN and programmer from Arduino IDE verbose output
   - Click "Save Configuration"

4. **Flash a board**:
   - Select a color from the dropdown (or search by name)
   - Click "Upload to GlowBlock"
   - Watch the console for progress

### Package as App (Optional)

Build a standalone `.app` file for macOS:

```bash
cd tools/firmware-flasher-gui
npm run build
```

The app will be in `dist/mac/GlowBlocks Flasher.app`.

### CLI vs GUI

- **CLI** - Faster for batch operations, scriptable, lightweight
- **GUI** - Easier for occasional use, visual color selection, guided setup

Both use the same underlying scripts (`prepare-sketch.mjs` + `flash.mjs`).

## Troubleshooting

- **`arduino-cli: command not found`** — install CLI and ensure it’s on `PATH`.
- **Wrong FQBN / programmer** — always copy from **verbose** IDE upload log; names differ by core version.
- **Upload fails** — same wiring and port as IDE; close Serial Monitor if it locks the port.

## Source of truth for colours

`colors.json` is generated from `src/data/popupColorCatalog.ts`. After you change the catalog in the repo, run `sync-colors.mjs` again.
