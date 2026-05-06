// State
let allColors = [];
let filteredColors = [];
let currentConfig = null;
let selectedColor = null;
let isUploading = false;
let currentBrightness = 80;
let presets = [];
let currentMode = 'single'; // 'single' or 'batch'
let batchState = {
  letters: [],
  assignments: {}, // { 0: { name, r, g, b }, 1: { ... }, ... } — index-based for duplicate letter support
  currentIndex: null,
  uploadIndex: 0
};

// DOM Elements
const configSection = document.getElementById('config-section');
const configForm = document.getElementById('config-form');
const configSummary = document.getElementById('config-summary');
const configStatus = document.getElementById('config-status');
const arduinoStatus = document.getElementById('arduino-status');
const configMessage = document.getElementById('config-message');
const uploadStatus = document.getElementById('upload-status');
const consoleOutput = document.getElementById('console-output');
const uploadBtn = document.getElementById('upload-btn');

// Mode selection
const modeSingleBtn = document.getElementById('mode-single');
const modeBatchBtn = document.getElementById('mode-batch');

// Color selection elements
const colorSearch = document.getElementById('color-search');
const colorSelect = document.getElementById('color-select');
const colorIdInput = document.getElementById('color-id');
const rgbR = document.getElementById('rgb-r');
const rgbG = document.getElementById('rgb-g');
const rgbB = document.getElementById('rgb-b');
const brightnessInput = document.getElementById('brightness-input');
const brightnessSlider = document.getElementById('brightness-slider');
const brightnessScope = document.getElementById('brightness-scope');
const previewSwatch = document.getElementById('preview-swatch');
const previewName = document.getElementById('preview-name');
const previewRgb = document.getElementById('preview-rgb');

// Config elements
const sketchDirInput = document.getElementById('sketch-dir');
const fqbnInput = document.getElementById('fqbn');
const portSelect = document.getElementById('port');
const programmerInput = document.getElementById('programmer');

// Batch elements
const batchInputSection = document.getElementById('batch-input-section');
const batchLettersSection = document.getElementById('batch-letters-section');
const batchAssignmentSection = document.getElementById('batch-assignment-section');
const batchLettersInput = document.getElementById('batch-letters');
const saveLettersBtn = document.getElementById('save-letters');
const letterButtonsContainer = document.getElementById('letter-buttons');
const backToInputBtn = document.getElementById('back-to-input');
const applyColorAllBtn = document.getElementById('apply-color-all');
const currentLetterDisplay = document.getElementById('current-letter-display');
const assignColorBtn = document.getElementById('assign-color-btn');
const assignLetterLabel = document.getElementById('assign-letter-label');
const batchAssignmentStatus = document.getElementById('batch-assignment-status');

// Upload elements
const uploadSection = document.getElementById('upload-section');
const singleUploadArea = document.getElementById('single-upload-area');
const batchUploadArea = document.getElementById('batch-upload-area');
const uploadNextBtn = document.getElementById('upload-next');
const skipBatchBtn = document.getElementById('skip-batch');

// Preset elements
const presetsContainer = document.getElementById('presets-container');

// Initialize
async function init() {
  setupTabs();
  setupEventListeners();
  await checkArduinoCLI();
  await loadColors();
  await loadPresets();
  await loadConfig();
  await refreshPorts();
  updateUploadButton();
}

// Tab switching
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;

      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`tab-${tabName}`).classList.add('active');

      updateColorPreview();
    });
  });
}

// Event listeners
function setupEventListeners() {
  // Mode selection
  modeSingleBtn.addEventListener('click', () => switchMode('single'));
  modeBatchBtn.addEventListener('click', () => switchMode('batch'));

  // Color selection by name
  colorSearch.addEventListener('input', handleColorSearch);
  colorSelect.addEventListener('change', () => updateColorPreview());

  // Color selection by ID
  colorIdInput.addEventListener('input', () => updateColorPreview());

  // Color selection by RGB
  [rgbR, rgbG, rgbB].forEach(input => {
    input.addEventListener('input', () => updateColorPreview());
  });

  // Brightness controls (sync input and slider)
  brightnessInput.addEventListener('input', () => {
    currentBrightness = parseInt(brightnessInput.value) || 0;
    brightnessSlider.value = currentBrightness;
  });
  brightnessSlider.addEventListener('input', () => {
    currentBrightness = parseInt(brightnessSlider.value);
    brightnessInput.value = currentBrightness;
  });

  // Config buttons
  document.getElementById('save-config').addEventListener('click', saveConfig);
  document.getElementById('edit-config').addEventListener('click', editConfig);
  document.getElementById('browse-dir').addEventListener('click', selectDirectory);
  document.getElementById('refresh-ports').addEventListener('click', refreshPorts);

  // Upload button
  uploadBtn.addEventListener('click', handleUpload);

  // Batch buttons
  saveLettersBtn.addEventListener('click', handleSaveLetters);
  backToInputBtn.addEventListener('click', handleBackToInput);
  applyColorAllBtn.addEventListener('click', handleApplyColorToAll);
  assignColorBtn.addEventListener('click', handleAssignColor);
  uploadNextBtn.addEventListener('click', handleBatchUploadNext);
  skipBatchBtn.addEventListener('click', handleBatchSkip);

  // Update assign button when color changes
  colorSelect.addEventListener('change', updateAssignButton);
  colorIdInput.addEventListener('input', updateAssignButton);
  [rgbR, rgbG, rgbB].forEach(input => {
    input.addEventListener('input', updateAssignButton);
  });

  // Output listeners
  window.flasherAPI.onPrepareOutput((data) => {
    appendConsole(data);
  });

  window.flasherAPI.onFlashOutput((data) => {
    appendConsole(data);
  });
}

// Check if arduino-cli is installed
async function checkArduinoCLI() {
  try {
    const installed = await window.flasherAPI.checkArduinoCLI();
    if (installed) {
      arduinoStatus.textContent = '✓ arduino-cli installed';
      arduinoStatus.className = 'status-badge success';
    } else {
      arduinoStatus.textContent = '⚠ arduino-cli not found';
      arduinoStatus.className = 'status-badge warning';
    }
  } catch (error) {
    arduinoStatus.textContent = '✗ arduino-cli error';
    arduinoStatus.className = 'status-badge error';
  }
}

// Load colors from catalog
async function loadColors() {
  try {
    allColors = await window.flasherAPI.getColors();
    filteredColors = [...allColors];
    populateColorSelect(filteredColors);
  } catch (error) {
    showMessage(configMessage, 'error', `Failed to load colors: ${error.message}`);
  }
}

// Populate color dropdown
function populateColorSelect(colors) {
  colorSelect.innerHTML = colors.length === 0
    ? '<option value="">No matching colors</option>'
    : colors.map(c => `<option value="${c.id}">#${c.id} - ${c.name}</option>`).join('');
}

// Handle color search
function handleColorSearch() {
  const query = colorSearch.value.toLowerCase().trim();

  if (query === '') {
    filteredColors = [...allColors];
  } else {
    filteredColors = allColors.filter(c =>
      c.name.toLowerCase().includes(query) ||
      String(c.id).includes(query)
    );
  }

  populateColorSelect(filteredColors);
  updateColorPreview();
}

// === MODE SWITCHING ===

function switchMode(mode) {
  currentMode = mode;

  // Update mode buttons
  modeSingleBtn.classList.toggle('active', mode === 'single');
  modeBatchBtn.classList.toggle('active', mode === 'batch');

  if (mode === 'single') {
    // Show single upload UI
    batchInputSection.style.display = 'none';
    batchLettersSection.style.display = 'none';
    batchAssignmentSection.style.display = 'none';
    singleUploadArea.style.display = 'block';
    batchUploadArea.style.display = 'none';
    brightnessScope.textContent = 'this block';
    document.getElementById('color-section-title').textContent = 'Color Selection';
    document.getElementById('upload-section-title').textContent = 'Upload Firmware';
  } else {
    // Show batch input UI
    batchInputSection.style.display = 'block';
    batchLettersSection.style.display = 'none';
    batchAssignmentSection.style.display = 'none';
    singleUploadArea.style.display = 'none';
    batchUploadArea.style.display = 'none';
    brightnessScope.textContent = 'all blocks';
    document.getElementById('color-section-title').textContent = 'Color Selection';
    document.getElementById('upload-section-title').textContent = 'Batch Upload';

    // Reset batch state
    batchState.letters = [];
    batchState.assignments = {};
    batchState.currentIndex = null;
    batchState.uploadIndex = 0;
    batchLettersInput.value = '';
  }
}

// Update color preview
function updateColorPreview() {
  const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
  let color = null;

  if (activeTab === 'name') {
    const selectedId = parseInt(colorSelect.value);
    color = allColors.find(c => c.id === selectedId);
  } else if (activeTab === 'id') {
    const id = parseInt(colorIdInput.value);
    color = allColors.find(c => c.id === id);
  } else if (activeTab === 'rgb') {
    const r = parseInt(rgbR.value) || 0;
    const g = parseInt(rgbG.value) || 0;
    const b = parseInt(rgbB.value) || 0;

    if (rgbR.value && rgbG.value && rgbB.value) {
      color = { name: 'Custom RGB', r, g, b };
    }
  }

  selectedColor = color;

  if (color) {
    previewSwatch.style.background = `rgb(${color.r}, ${color.g}, ${color.b})`;
    previewName.textContent = color.name;
    previewRgb.textContent = `RGB(${color.r}, ${color.g}, ${color.b})`;
  } else {
    previewSwatch.style.background = '#333';
    previewName.textContent = 'No color selected';
    previewRgb.textContent = '';
  }

  updateUploadButton();
}

// Load configuration
async function loadConfig() {
  try {
    currentConfig = await window.flasherAPI.getConfig();

    if (currentConfig) {
      sketchDirInput.value = currentConfig.sketchDir || '';
      fqbnInput.value = currentConfig.fqbn || '';
      portSelect.value = currentConfig.port || '';
      programmerInput.value = currentConfig.programmer || '';

      configForm.style.display = 'none';
      configSummary.style.display = 'block';
      configStatus.textContent = '✓ Config loaded';
      configStatus.className = 'status-badge success';
    } else {
      configForm.style.display = 'block';
      configSummary.style.display = 'none';
      configStatus.textContent = '⚠ Setup needed';
      configStatus.className = 'status-badge warning';
    }
  } catch (error) {
    showMessage(configMessage, 'error', `Failed to load config: ${error.message}`);
  }

  updateUploadButton();
}

// Save configuration
async function saveConfig() {
  const config = {
    sketchDir: sketchDirInput.value.trim(),
    fqbn: fqbnInput.value.trim(),
    port: portSelect.value,
    programmer: programmerInput.value.trim()
  };

  if (!config.sketchDir || !config.fqbn || !config.port || !config.programmer) {
    showMessage(configMessage, 'error', 'All fields are required');
    return;
  }

  try {
    await window.flasherAPI.saveConfig(config);
    currentConfig = config;
    showMessage(configMessage, 'success', 'Configuration saved successfully');

    setTimeout(() => {
      configForm.style.display = 'none';
      configSummary.style.display = 'block';
      configStatus.textContent = '✓ Config loaded';
      configStatus.className = 'status-badge success';
      updateUploadButton();
    }, 1500);
  } catch (error) {
    showMessage(configMessage, 'error', `Failed to save config: ${error.message}`);
  }
}

// Edit configuration
function editConfig() {
  configForm.style.display = 'block';
  configSummary.style.display = 'none';
}

// Select directory
async function selectDirectory() {
  try {
    const path = await window.flasherAPI.selectDirectory();
    if (path) {
      sketchDirInput.value = path;
    }
  } catch (error) {
    showMessage(configMessage, 'error', `Failed to select directory: ${error.message}`);
  }
}

// Refresh serial port dropdown
async function refreshPorts() {
  const savedPort = portSelect.value || (currentConfig && currentConfig.port) || '';
  portSelect.innerHTML = '<option value="">Scanning...</option>';

  try {
    const ports = await window.flasherAPI.listSerialPorts();

    if (ports.length === 0) {
      portSelect.innerHTML = '<option value="">No ports detected</option>';
      showMessage(configMessage, 'info', 'No serial ports detected. Is the programmer connected?');
    } else {
      portSelect.innerHTML = ports.map(p =>
        `<option value="${p.address}">${p.address}${p.label && p.label !== p.address ? ' (' + p.label + ')' : ''}</option>`
      ).join('');

      // Restore previously selected port if still available
      if (savedPort && [...portSelect.options].some(o => o.value === savedPort)) {
        portSelect.value = savedPort;
      }

      showMessage(configMessage, 'success', `Found ${ports.length} port${ports.length !== 1 ? 's' : ''}`);
    }
  } catch (error) {
    portSelect.innerHTML = '<option value="">Error scanning ports</option>';
    showMessage(configMessage, 'error', `Failed to detect ports: ${error.message}`);
  }
}

// Handle upload
async function handleUpload() {
  if (isUploading || !selectedColor || !currentConfig) return;

  isUploading = true;
  uploadBtn.disabled = true;
  uploadBtn.textContent = 'Uploading...';
  consoleOutput.textContent = '';
  showMessage(uploadStatus, 'info', 'Preparing sketch...');

  try {
    // Get color args based on active tab
    const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
    let colorArgs;

    if (activeTab === 'name') {
      colorArgs = { type: 'name', value: selectedColor.name };
    } else if (activeTab === 'id') {
      colorArgs = { type: 'id', value: selectedColor.id };
    } else if (activeTab === 'rgb') {
      colorArgs = { type: 'rgb', value: `${selectedColor.r},${selectedColor.g},${selectedColor.b}` };
    }

    // Add brightness to color args
    colorArgs.brightness = currentBrightness;

    // Prepare sketch
    appendConsole('=== Preparing sketch ===\n');
    await window.flasherAPI.prepareSketch(colorArgs);

    // Flash firmware
    appendConsole('\n=== Flashing firmware ===\n');
    showMessage(uploadStatus, 'info', 'Compiling and uploading...');
    await window.flasherAPI.flashFirmware();

    appendConsole('\n=== Upload complete! ===\n');
    showMessage(uploadStatus, 'success', `✓ Successfully uploaded ${selectedColor.name}`);
  } catch (error) {
    appendConsole(`\n✗ Error: ${error.message}\n`);
    showMessage(uploadStatus, 'error', `Upload failed: ${error.message}`);
  } finally {
    isUploading = false;
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload to GlowBlock';
    updateUploadButton();
  }
}

// Update upload button state
function updateUploadButton() {
  if (isUploading) {
    uploadBtn.disabled = true;
    return;
  }

  const hasColor = selectedColor !== null;
  const hasConfig = currentConfig !== null;

  uploadBtn.disabled = !hasColor || !hasConfig;

  if (!hasConfig) {
    uploadBtn.title = 'Configure settings first';
  } else if (!hasColor) {
    uploadBtn.title = 'Select a color first';
  } else {
    uploadBtn.title = `Upload ${selectedColor.name}`;
  }
}

// Append to console
function appendConsole(text) {
  consoleOutput.textContent += text;
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// Show message
function showMessage(element, type, text) {
  element.textContent = text;
  element.className = `message ${type}`;
}

// === BATCH MODE FUNCTIONS ===

function handleSaveLetters() {
  const letters = batchLettersInput.value.trim().toUpperCase();

  if (!letters) {
    showMessage(batchAssignmentStatus, 'error', 'Please enter at least one letter');
    return;
  }

  if (!/^[A-Z]+$/.test(letters)) {
    showMessage(batchAssignmentStatus, 'error', 'Only letters A-Z are allowed');
    return;
  }

  if (letters.length > 10) {
    showMessage(batchAssignmentStatus, 'error', 'Maximum 10 letters allowed');
    return;
  }

  // Save letters and show letter selection UI
  batchState.letters = letters.split('');
  batchState.assignments = {};
  batchState.currentIndex = null;

  renderLetterButtons();

  batchInputSection.style.display = 'none';
  batchLettersSection.style.display = 'block';
  showMessage(batchAssignmentStatus, 'info', 'Click a letter to assign a color');
}

function renderLetterButtons() {
  const html = batchState.letters.map((letter, idx) => {
    const assigned = batchState.assignments[idx];
    const activeClass = idx === batchState.currentIndex ? ' active' : '';
    const assignedClass = assigned ? ' assigned' : '';
    const colorIndicator = assigned
      ? `<div class="letter-color-indicator" style="background: rgb(${assigned.r},${assigned.g},${assigned.b})"></div>`
      : '';

    return `
      <button class="letter-btn${activeClass}${assignedClass}" data-index="${idx}">
        ${letter}
        ${colorIndicator}
      </button>
    `;
  }).join('');

  letterButtonsContainer.innerHTML = html;

  // Add click handlers
  document.querySelectorAll('.letter-btn').forEach(btn => {
    btn.addEventListener('click', () => handleLetterClick(parseInt(btn.dataset.index)));
  });
}

function handleLetterClick(index) {
  batchState.currentIndex = index;
  const letter = batchState.letters[index];
  currentLetterDisplay.textContent = `${letter} (#${index + 1})`;
  assignLetterLabel.textContent = `${letter} (#${index + 1})`;

  // Show assignment section
  batchLettersSection.style.display = 'none';
  batchAssignmentSection.style.display = 'block';

  // If this position already has a color, show it
  if (batchState.assignments[index]) {
    const color = batchState.assignments[index];
    showMessage(batchAssignmentStatus, 'info', `Current color: ${color.name}`);
  } else {
    showMessage(batchAssignmentStatus, 'info', 'Select a color and click "Assign Color"');
  }

  updateAssignButton();
}

function updateAssignButton() {
  if (batchState.currentIndex === null) {
    assignColorBtn.disabled = true;
    return;
  }
  assignColorBtn.disabled = selectedColor === null;
}

function handleAssignColor() {
  if (!selectedColor || batchState.currentIndex === null) return;

  const letter = batchState.letters[batchState.currentIndex];
  // Assign color to current index position
  batchState.assignments[batchState.currentIndex] = { ...selectedColor };

  showMessage(batchAssignmentStatus, 'success', `✓ Assigned ${selectedColor.name} to ${letter} (#${batchState.currentIndex + 1})`);

  // Go back to letter selection after 1 second
  setTimeout(() => {
    batchAssignmentSection.style.display = 'none';
    batchLettersSection.style.display = 'block';
    batchState.currentIndex = null;
    renderLetterButtons();

    // Check if all positions are assigned
    const allAssigned = batchState.letters.every((_, idx) => batchState.assignments[idx]);
    if (allAssigned) {
      showMessage(batchAssignmentStatus, 'success', '✓ All letters assigned! Ready to upload.');
      // Show upload area
      batchLettersSection.style.display = 'none';
      startBatchUpload();
    }
  }, 1000);
}

function handleApplyColorToAll() {
  if (!selectedColor) {
    showMessage(batchAssignmentStatus, 'error', 'Select a color first');
    return;
  }

  batchState.letters.forEach((_, idx) => {
    batchState.assignments[idx] = { ...selectedColor };
  });

  renderLetterButtons();
  showMessage(batchAssignmentStatus, 'success', `✓ Applied ${selectedColor.name} to all letters. Ready to upload.`);

  // Start upload after brief delay
  setTimeout(() => {
    batchLettersSection.style.display = 'none';
    startBatchUpload();
  }, 1000);
}

function handleBackToInput() {
  batchInputSection.style.display = 'block';
  batchLettersSection.style.display = 'none';
  batchAssignmentSection.style.display = 'none';
  batchState.letters = [];
  batchState.assignments = {};
  batchState.currentIndex = null;
}

function startBatchUpload() {
  batchState.uploadIndex = 0;
  updateBatchUploadPrompt();
  singleUploadArea.style.display = 'none';
  batchUploadArea.style.display = 'block';
}

function updateBatchUploadPrompt() {
  const currentLetter = batchState.letters[batchState.uploadIndex];
  const color = batchState.assignments[batchState.uploadIndex];

  document.getElementById('prompt-letter').textContent = currentLetter;
  document.getElementById('prompt-color').textContent = color.name;
  document.getElementById('prompt-swatch').style.background = `rgb(${color.r},${color.g},${color.b})`;

  // Render upload progress list
  const listHtml = batchState.letters.map((letter, idx) => {
    const color = batchState.assignments[idx];
    let status;
    if (idx < batchState.uploadIndex) {
      status = '<span class="batch-completed">✓ Uploaded</span>';
    } else if (idx === batchState.uploadIndex) {
      status = '<span class="batch-uploading">⟳ Ready to upload</span>';
    } else {
      status = '<span class="batch-pending">Pending</span>';
    }
    return `<div class="batch-letter-item">
      <strong>${letter}</strong>: ${color.name} ${status}
    </div>`;
  }).join('');

  document.getElementById('batch-upload-list').innerHTML = listHtml;
}

async function handleBatchUploadNext() {
  if (!currentConfig) {
    showMessage(document.getElementById('batch-upload-status'), 'error', 'Configuration needed');
    return;
  }

  const currentLetter = batchState.letters[batchState.uploadIndex];
  const color = batchState.assignments[batchState.uploadIndex];

  uploadNextBtn.disabled = true;
  skipBatchBtn.disabled = true;
  showMessage(document.getElementById('batch-upload-status'), 'info', `Uploading ${currentLetter}...`);
  consoleOutput.textContent = '';

  try {
    const colorArgs = {
      type: 'rgb',
      value: `${color.r},${color.g},${color.b}`,
      brightness: currentBrightness
    };

    appendConsole(`=== Uploading letter ${currentLetter} (${color.name}) ===\n`);
    await window.flasherAPI.prepareSketch(colorArgs);
    await window.flasherAPI.flashFirmware();
    appendConsole(`\n=== ${currentLetter} upload complete! ===\n`);

    showMessage(document.getElementById('batch-upload-status'), 'success', `✓ ${currentLetter} uploaded successfully`);

    setTimeout(() => {
      batchState.uploadIndex++;
      if (batchState.uploadIndex >= batchState.letters.length) {
        showMessage(document.getElementById('batch-upload-status'), 'success', '✓ All blocks uploaded!');
        setTimeout(() => switchMode('batch'), 2000); // Reset after 2 seconds
      } else {
        updateBatchUploadPrompt();
        showMessage(document.getElementById('batch-upload-status'), 'info', 'Connect next block when ready');
      }
    }, 1500);

  } catch (error) {
    appendConsole(`\n✗ Error: ${error.message}\n`);
    showMessage(document.getElementById('batch-upload-status'), 'error', `Upload failed: ${error.message}`);
  } finally {
    uploadNextBtn.disabled = false;
    skipBatchBtn.disabled = false;
  }
}

function handleBatchSkip() {
  batchState.uploadIndex++;
  if (batchState.uploadIndex >= batchState.letters.length) {
    showMessage(document.getElementById('batch-upload-status'), 'success', 'Batch complete');
    setTimeout(() => switchMode('batch'), 2000);
  } else {
    updateBatchUploadPrompt();
  }
}

// === PRESET FUNCTIONS ===

async function loadPresets() {
  try {
    const data = await window.flasherAPI.getPresets();
    presets = data.presets || [];
    renderPresets();
  } catch (error) {
    console.error('Failed to load presets:', error);
    presetsContainer.innerHTML = '<p style="color: #888;">Failed to load color presets</p>';
  }
}

function renderPresets() {
  const html = presets.map(preset => {
    const swatches = preset.colors.map(c =>
      `<div class="preset-swatch" style="background: rgb(${c.r},${c.g},${c.b})" title="${c.name}"></div>`
    ).join('');

    return `
      <div class="preset-card" data-preset-id="${preset.id}">
        <div class="preset-name">${preset.name}</div>
        <div class="preset-swatches">${swatches}</div>
      </div>
    `;
  }).join('');

  presetsContainer.innerHTML = html;

  // Add click handlers to apply preset
  document.querySelectorAll('.preset-card').forEach(card => {
    card.addEventListener('click', () => handlePresetClick(card.dataset.presetId));
  });
}

function handlePresetClick(presetId) {
  const preset = presets.find(p => p.id === presetId);
  if (!preset) return;

  if (currentMode === 'single') {
    // Apply first color to RGB inputs
    const firstColor = preset.colors[0];
    rgbR.value = firstColor.r;
    rgbG.value = firstColor.g;
    rgbB.value = firstColor.b;
    updateColorPreview();
  } else {
    // Batch mode: auto-fill letters and assign colors
    switchMode('batch');
    const letterCount = preset.colors.length;
    const suggestedLetters = 'ABCDEFGHIJ'.substring(0, letterCount);
    batchLettersInput.value = suggestedLetters;
    batchState.letters = suggestedLetters.split('');
    batchState.assignments = {};

    // Auto-assign preset colors
    preset.colors.forEach((color, idx) => {
      batchState.assignments[idx] = { ...color };
    });

    // Show letter buttons
    renderLetterButtons();
    batchInputSection.style.display = 'none';
    batchLettersSection.style.display = 'block';

    // Automatically start upload
    setTimeout(() => startBatchUpload(), 500);
  }
}

// Start the app
init();
