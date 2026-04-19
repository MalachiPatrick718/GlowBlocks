const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('flasherAPI', {
  // Color catalog
  getColors: () => ipcRenderer.invoke('get-colors'),
  getPresets: () => ipcRenderer.invoke('get-presets'),

  // Configuration
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),

  // Arduino CLI
  checkArduinoCLI: () => ipcRenderer.invoke('check-arduino-cli'),
  listSerialPorts: () => ipcRenderer.invoke('list-serial-ports'),

  // Flashing
  prepareSketch: (colorArgs) => ipcRenderer.invoke('prepare-sketch', colorArgs),
  flashFirmware: () => ipcRenderer.invoke('flash-firmware'),

  // Output listeners
  onPrepareOutput: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('prepare-output', listener);
    return () => ipcRenderer.removeListener('prepare-output', listener);
  },

  onFlashOutput: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('flash-output', listener);
    return () => ipcRenderer.removeListener('flash-output', listener);
  }
});
