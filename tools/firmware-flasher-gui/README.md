# GlowBlocks Firmware Flasher GUI

Desktop application for flashing GlowBlocks firmware to ATtiny1616 via ESP32 UPDI programmer.

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Launch the app**:
   ```bash
   npm start
   ```

## Development

- `npm run dev` - Start in development mode with DevTools
- `npm run package` - Build for current platform
- `npm run build` - Build production app + installer

## Prerequisites

Before using the GUI, ensure you have:

1. **arduino-cli** installed (`brew install arduino-cli`)
2. **megaTinyCore** installed (see parent README)
3. **Adafruit NeoPixel** library installed
4. **FQBN, port, and programmer** values from Arduino IDE

The GUI will guide you through the configuration on first launch.

## How It Works

This GUI is a wrapper around the existing CLI tools:

1. User selects a color (by name, ID, or custom RGB)
2. Click "Upload" calls `prepare-sketch.mjs` with color args
3. Then calls `flash.mjs` to compile and upload
4. Output is streamed to the console in real-time

## Project Structure

```
firmware-flasher-gui/
├── main.js          # Electron main process (Node.js)
├── preload.js       # IPC bridge (security layer)
├── renderer/
│   ├── index.html   # UI layout
│   ├── styles.css   # Styling
│   └── renderer.js  # Frontend logic
└── package.json     # Dependencies + build config
```

## Troubleshooting

**"arduino-cli not found"**
- Install with `brew install arduino-cli`
- Restart the app after installing

**"No serial ports detected"**
- Make sure ESP32 is connected via USB
- Check that drivers are installed for your USB-to-serial chip

**Upload fails**
- Verify wiring matches the firmware comments
- Check that firmware.config.json has correct FQBN and programmer
- Close Arduino IDE Serial Monitor if it's locking the port

## Building for Distribution

Build standalone app:

```bash
npm run build
```

Output: `dist/mac/GlowBlocks Flasher.app` (macOS)

The app includes all necessary scripts and will work offline.
