// contentScript.js

/**
 * Checks the URL and injects the button if we are in a folder.
 */
function checkAndInject() {
    // Check if we are in a folder view
    const currentUrl = window.location.href;
    const folderMatch = currentUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);

    if (folderMatch) {
        const folderId = folderMatch[1];
        tryInjectButton(folderId);
    } else {
        removeButton();
    }
}

/**
 * Tries to find the target container and inject the button.
 * Retries a few times if the DOM isn't ready.
 */
function tryInjectButton(folderId) {
    // Target container: class "a-s-tb-sc-Ja-Q-x a-Ba-Ed a-s-Ba-ic"
    // Note: Google Drive classes are obfuscated and might change.
    // The user provided: "a-s-tb-sc-Ja-Q-x a-Ba-Ed a-s-Ba-ic"
    const targetSelector = '.a-s-tb-sc-Ja-Q-x.a-Ba-Ed.a-s-Ba-ic';
    const container = document.querySelector(targetSelector);

    if (container) {
        // limit: preventing duplicate buttons
        if (!container.querySelector('.open-explorer-btn')) {
            createButton(container, folderId);
        } else {
            // If button exists, just update the click handler/ID if needed, 
            // but simpler to remove and re-add or just leave it if ID matches.
            // For now, let's assume if it's there, we might need to update it 
            // IF the folder ID changed without a full reload (SPA navigation).
            // But checkAndInject is called on mutation, so let's update ID.
            updateButtonAction(container.querySelector('.open-explorer-btn'), folderId);
        }
    }
}

function removeButton() {
    const btn = document.querySelector('.open-explorer-btn');
    if (btn) btn.remove();
}

/**
 * Creates the button DOM element
 */
function createButton(container, folderId) {
    const btn = document.createElement('button');
    btn.className = 'open-explorer-btn';
    btn.title = 'Open in Explorer';

    // Create Icon Image
    const img = document.createElement('img');
    img.src = chrome.runtime.getURL('icons/icon128.png');
    img.alt = 'Open in Explorer';

    btn.appendChild(img);

    // Insert at the end of the container
    container.appendChild(btn);

    // Initial setup of the click action
    updateButtonAction(btn, folderId);
}

/**
 * Sets the onclick behavior.
 * We need to extract the folder name dynamically at the moment of click, 
 * because the title might load lazily.
 */
function updateButtonAction(btn, folderId) {
    btn.onclick = () => {
        // Extract Folder Name
        // Target: "h-sb-Ic h-R-w-d-ff"
        const nameSelector = '.h-sb-Ic.h-R-w-d-ff';
        const titleEl = document.querySelector(nameSelector);

        let folderName = "Unknown";
        if (titleEl) {
            folderName = titleEl.textContent.trim();
        } else {
            console.warn("Could not find folder name element:", nameSelector);
            // Fallback: try document title
            folderName = document.title.replace(" - Google Drive", "").trim();
        }

        console.log(`Clicked! Opening ID: ${folderId}, Name: ${folderName}`);

        // Send message to background script
        chrome.runtime.sendMessage({
            action: "openFolder",
            folderId: folderId,
            folderName: folderName
        }, (response) => {
            if (response && response.success) {
                console.log("Success:", response);
            } else {
                console.error("Failed:", response);
                alert("Failed to open folder. Make sure the Native Host is installed.");
            }
        });
    };
}

// Observe DOM changes to handle navigation (SPA)
const observer = new MutationObserver((mutations) => {
    // Debounce or just run check. 
    // Since Drive changes DOM a lot, we verify if URL changed or if our container appeared.
    checkAndInject();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Initial check
checkAndInject();
