// popup.js

document.addEventListener('DOMContentLoaded', () => {
    const extensionEnabledSwitch = document.getElementById('extensionEnabled');
    const statusBadge = document.getElementById('statusBadge');
    const settingsSection = document.getElementById('settingsSection');
    const versionBadge = document.getElementById('versionBadge');

    // Auto-populate version from manifest
    try {
        const manifest = chrome.runtime.getManifest();
        if (versionBadge && manifest && manifest.version) {
            versionBadge.textContent = `v${manifest.version}`;
        }
    } catch (e) {
        console.warn("Failed to get manifest version:", e);
    }

    const driveSelect = document.getElementById('driveLetter');
    const driveRootInput = document.getElementById('driveRootName');
    const pathDepthSelect = document.getElementById('pathDepth');
    const openModeSelect = document.getElementById('openMode');
    const enableLoggingCheckbox = document.getElementById('enableLogging');

    function updateStatusUI(isEnabled) {
        if (isEnabled) {
            statusBadge.textContent = 'Active';
            statusBadge.classList.remove('disabled');
            settingsSection.classList.remove('dimmed');
        } else {
            statusBadge.textContent = 'Disabled';
            statusBadge.classList.add('disabled');
            settingsSection.classList.add('dimmed');
        }
    }

    // Load saved settings
    chrome.storage.local.get(['extensionEnabled', 'driveLetter', 'driveRootName', 'pathDepth', 'openMode', 'enableLogging'], (result) => {
        const isEnabled = result.extensionEnabled !== undefined ? result.extensionEnabled : true;
        extensionEnabledSwitch.checked = isEnabled;
        updateStatusUI(isEnabled);

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

    // Toggle master switch
    extensionEnabledSwitch.addEventListener('change', () => {
        const isEnabled = extensionEnabledSwitch.checked;
        updateStatusUI(isEnabled);
        chrome.storage.local.set({ extensionEnabled: isEnabled });
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
