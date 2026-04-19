const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Paths to firmware-flasher directory (sibling directory)
// Handle both development and packaged app
const isDev = !app.isPackaged;
const flasherDir = isDev
  ? path.join(__dirname, '..', 'firmware-flasher')
  : path.join(process.resourcesPath, 'firmware-flasher');  // In Resources/firmware-flasher/

const colorsPath = path.join(flasherDir, 'colors.json');

// Store config in user's home directory (writable location)
const configDir = path.join(os.homedir(), '.glowblocks');
const configPath = path.join(configDir, 'firmware.config.json');

const prepareScriptPath = path.join(flasherDir, 'prepare-sketch.mjs');
const flashScriptPath = path.join(flasherDir, 'flash.mjs');

// Ensure config directory exists
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// Fix PATH for packaged app to find arduino-cli
const fixedEnv = {
  ...process.env,
  PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:/opt/local/bin`
};

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 750,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'GlowBlocks Programmer',
    resizable: true,
    backgroundColor: '#1a1a1a'
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Open DevTools in development
  if (process.argv.includes('--enable-logging')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

// Load color catalog
ipcMain.handle('get-colors', async () => {
  try {
    console.log('Looking for colors.json at:', colorsPath);
    console.log('__dirname is:', __dirname);
    console.log('flasherDir is:', flasherDir);
    console.log('File exists?', fs.existsSync(colorsPath));
    if (!fs.existsSync(colorsPath)) {
      throw new Error('colors.json not found. Run: npm run firmware:sync-colors');
    }
    const data = fs.readFileSync(colorsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading colors:', error);
    throw error;
  }
});

// Load color presets
ipcMain.handle('get-presets', async () => {
  try {
    const presetsPath = path.join(flasherDir, 'presets.json');
    console.log('Looking for presets.json at:', presetsPath);
    if (!fs.existsSync(presetsPath)) {
      throw new Error('presets.json not found');
    }
    const data = fs.readFileSync(presetsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading presets:', error);
    throw error;
  }
});

// Get current config
ipcMain.handle('get-config', async () => {
  try {
    if (!fs.existsSync(configPath)) {
      return null;
    }
    const data = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading config:', error);
    return null;
  }
});

// Save config
ipcMain.handle('save-config', async (event, config) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Error saving config:', error);
    throw error;
  }
});

// Check if arduino-cli is installed
ipcMain.handle('check-arduino-cli', async () => {
  return new Promise((resolve) => {
    const child = spawn('which', ['arduino-cli'], { env: fixedEnv });
    child.on('close', (code) => {
      resolve(code === 0);
    });
    child.on('error', () => {
      resolve(false);
    });
  });
});

// List serial ports using arduino-cli
ipcMain.handle('list-serial-ports', async () => {
  return new Promise((resolve, reject) => {
    const child = spawn('arduino-cli', ['board', 'list', '--format', 'json'], { env: fixedEnv });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`arduino-cli failed: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        const ports = result.detected_ports || [];
        const portList = ports.map(p => ({
          address: p.port?.address || p.address,
          protocol: p.port?.protocol || p.protocol,
          label: p.port?.label || p.label || p.port?.address || p.address
        }));
        resolve(portList);
      } catch (error) {
        reject(error);
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
});

// Select directory for sketch folder
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Sketch Directory',
    message: 'Choose a folder for GlowBlocksFirmware_v3'
  });

  if (result.canceled) {
    return null;
  }
  return result.filePaths[0];
});

// Prepare sketch with selected color
ipcMain.handle('prepare-sketch', async (event, colorArgs) => {
  return new Promise((resolve, reject) => {
    const args = ['prepare-sketch.mjs'];

    if (colorArgs.type === 'name') {
      args.push('--name', colorArgs.value);
    } else if (colorArgs.type === 'id') {
      args.push('--id', String(colorArgs.value));
    } else if (colorArgs.type === 'rgb') {
      args.push('--rgb', colorArgs.value);
    }

    // Add brightness if provided
    if (colorArgs.brightness !== undefined) {
      args.push('--brightness', String(colorArgs.brightness));
    }

    const child = spawn('node', args, { cwd: flasherDir, env: fixedEnv });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      event.sender.send('prepare-output', text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      event.sender.send('prepare-output', text);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output: stdout });
      } else {
        reject(new Error(`prepare-sketch failed: ${stderr || stdout}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
});

// Flash firmware
ipcMain.handle('flash-firmware', async (event) => {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['flash.mjs'], { cwd: flasherDir, env: fixedEnv });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      event.sender.send('flash-output', text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      event.sender.send('flash-output', text);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output: stdout });
      } else {
        reject(new Error(`flash failed (exit code ${code}): ${stderr || stdout}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
});
