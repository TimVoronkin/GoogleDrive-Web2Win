// popup.js

document.addEventListener('DOMContentLoaded', () => {
    const driveSelect = document.getElementById('driveLetter');

    // Load saved value
    chrome.storage.local.get(['driveLetter'], (result) => {
        if (result.driveLetter) {
            driveSelect.value = result.driveLetter;
        }
    });

    // Save on change
    driveSelect.addEventListener('change', () => {
        const newValue = driveSelect.value;
        chrome.storage.local.set({ driveLetter: newValue }, () => {
            console.log('Drive letter saved:', newValue);
        });
    });
});
