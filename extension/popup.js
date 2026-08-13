// popup.js

document.addEventListener('DOMContentLoaded', () => {
    const driveSelect = document.getElementById('driveLetter');
    const driveRootInput = document.getElementById('driveRootName');
    const pathDepthSelect = document.getElementById('pathDepth');
    const openModeSelect = document.getElementById('openMode');
    const enableLoggingCheckbox = document.getElementById('enableLogging');

    // Load saved settings
    chrome.storage.local.get(['driveLetter', 'driveRootName', 'pathDepth', 'openMode', 'enableLogging'], (result) => {
        if (result.driveLetter) {
            driveSelect.value = result.driveLetter;
        }
        if (result.driveRootName !== undefined) {
            driveRootInput.value = result.driveRootName;
        }
        if (result.pathDepth !== undefined) {
            pathDepthSelect.value = result.pathDepth;
        }
        if (result.openMode !== undefined) {
            openModeSelect.value = result.openMode;
        }
        if (result.enableLogging !== undefined) {
            enableLoggingCheckbox.checked = result.enableLogging;
        }
    });

    // Save drive letter
    driveSelect.addEventListener('change', () => {
        chrome.storage.local.set({ driveLetter: driveSelect.value });
    });

    // Save drive root folder name
    driveRootInput.addEventListener('input', () => {
        chrome.storage.local.set({ driveRootName: driveRootInput.value.trim() || 'My Drive' });
    });

    // Save path depth limit
    pathDepthSelect.addEventListener('change', () => {
        chrome.storage.local.set({ pathDepth: parseInt(pathDepthSelect.value, 10) });
    });

    // Save open mode
    openModeSelect.addEventListener('change', () => {
        chrome.storage.local.set({ openMode: openModeSelect.value });
    });

    // Save enable logging toggle
    enableLoggingCheckbox.addEventListener('change', () => {
        chrome.storage.local.set({ enableLogging: enableLoggingCheckbox.checked });
    });
});

