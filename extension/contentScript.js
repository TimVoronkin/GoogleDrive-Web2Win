// contentScript.js

let isLoggingEnabled = true;

function gLog(...args) {
    if (isLoggingEnabled) console.log('[GDrive-Tim]', ...args);
}
function gWarn(...args) {
    if (isLoggingEnabled) console.warn('[GDrive-Tim]', ...args);
}
function gError(...args) {
    if (isLoggingEnabled) console.error('[GDrive-Tim]', ...args);
}

gLog("ContentScript initialized on page:", window.location.href);

// In-memory cache for file/folder parent hierarchy with 3-min TTL
const hierarchyCache = new Map();
const HIERARCHY_CACHE_TTL = 3 * 60 * 1000;
let currentRenderedId = null;

function getCachedHierarchy(fileId) {
    if (hierarchyCache.has(fileId)) {
        const entry = hierarchyCache.get(fileId);
        if (Date.now() - entry.timestamp < HIERARCHY_CACHE_TTL) {
            return entry.data;
        }
        hierarchyCache.delete(fileId);
    }
    return null;
}

function setCachedHierarchy(fileId, data) {
    hierarchyCache.set(fileId, { data: data, timestamp: Date.now() });
}

/**
 * Gets active settings from chrome.storage.local
 */
function getSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['extensionEnabled', 'driveLetter', 'driveRootName', 'pathDepth', 'openMode', 'enableLogging'], (result) => {
            isLoggingEnabled = result.enableLogging !== undefined ? result.enableLogging : true;
            const settings = {
                extensionEnabled: result.extensionEnabled !== undefined ? result.extensionEnabled : true,
                driveLetter: result.driveLetter || 'G',
                driveRootName: (result.driveRootName !== undefined && result.driveRootName !== '') ? result.driveRootName : 'My Drive',
                pathDepth: result.pathDepth !== undefined ? parseInt(result.pathDepth, 10) : 5,
                openMode: result.openMode || 'fullPath',
                enableLogging: isLoggingEnabled
            };
            resolve(settings);
        });
    });
}

/**
 * Helper to get current user index prefix from URL, e.g., '/u/0' or ''
 */
function getUserPrefix() {
    const match = window.location.pathname.match(/\/u\/(\d+)/);
    return match ? `/u/${match[1]}` : '';
}

/**
 * Checks if currently on the Root My Drive page
 */
function isRootMyDrivePage() {
    const href = window.location.href;
    const pathname = window.location.pathname;

    if (pathname.includes('/my-drive') || href.includes('/my-drive')) {
        return true;
    }

    const folderHeader = findFolderHeaderContainer();
    const bottomBar = findBottomStatusBarContainer();
    if (!folderHeader && !bottomBar) {
        if (!href.includes('/search') && !href.includes('/shared-with-me') && !href.includes('/recent') && !href.includes('/starred') && !href.includes('/home')) {
            return true;
        }
    }

    return false;
}

/**
 * Fetches item metadata and parents hierarchy using Google Drive API
 */
async function fetchItemHierarchy(fileId) {
    const cached = getCachedHierarchy(fileId);
    if (cached) return cached;

    try {
        const bgResponse = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: "fetchHierarchy",
                fileId: fileId
            }, (res) => resolve(res));
        });

        if (bgResponse && bgResponse.success && bgResponse.pathNodes && bgResponse.pathNodes.length > 0) {
            const data = {
                pathNodes: bgResponse.pathNodes,
                isMyDrive: bgResponse.isMyDrive !== false
            };
            setCachedHierarchy(fileId, data);
            return data;
        }
    } catch (e) {
        gError("Error sending message to background script:", e);
    }

    return null;
}

/**
 * Shows a toast message on screen
 */
function showToast(message) {
    let toast = document.querySelector('.web2win-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'web2win-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

/**
 * Finds currently selected file/folder in the main Google Drive content area (excluding left navigation sidebar)
 */
function findSelectedFileId() {
    const allSelected = document.querySelectorAll('[aria-selected="true"]');
    const mainSelected = [];

    for (const el of allSelected) {
        // Skip sidebar / tree navigation items
        if (el.getAttribute('role') === 'treeitem' || el.closest('[role="tree"], [role="navigation"], .a-U-J, .a-qc-La, .gb_T')) {
            continue;
        }

        let fileId = el.getAttribute('data-id') || el.getAttribute('data-item-id') || el.getAttribute('data-target-id');

        if (!fileId) {
            const childWithId = el.querySelector('[data-id], [data-item-id], [data-target-id]');
            if (childWithId) {
                fileId = childWithId.getAttribute('data-id') || childWithId.getAttribute('data-item-id') || childWithId.getAttribute('data-target-id');
            }
        }

        if (!fileId) {
            const parentWithId = el.closest('[data-id], [data-item-id], [data-target-id]');
            if (parentWithId) {
                fileId = parentWithId.getAttribute('data-id') || parentWithId.getAttribute('data-item-id') || parentWithId.getAttribute('data-target-id');
            }
        }

        if (fileId && fileId !== 'root' && !fileId.startsWith(':')) {
            const fileNameEl = el.querySelector('.MxB3Nd') || el.querySelector('[data-tooltip]') || el;
            const fileName = fileNameEl ? (fileNameEl.getAttribute('data-tooltip') || fileNameEl.textContent.trim()) : 'Item';
            mainSelected.push({ fileId, fileName, element: el });
        }
    }

    if (mainSelected.length === 1) {
        return mainSelected[0];
    }

    return null;
}

/**
 * Finds currently active target ID in Google Drive view or bottom panel
 */
function findActiveTargetId() {
    // 1. Check if bottom location bar is visible and contains button items with data-item-id
    const bottomBar = document.querySelector('.LVhrj:not(.YGHoCf)');
    if (bottomBar) {
        const buttons = bottomBar.querySelectorAll('button[data-item-id]');
        if (buttons.length > 0) {
            const lastBtn = buttons[buttons.length - 1];
            const itemId = lastBtn.getAttribute('data-item-id');
            if (itemId) {
                return itemId;
            }
        }
    }

    // 2. Check currently selected elements in grid/list views
    const selected = findSelectedFileId();
    if (selected) {
        return selected.fileId;
    }

    // 3. Check URL for folder ID
    const urlMatch = window.location.href.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (urlMatch) {
        return urlMatch[1];
    }

    return null;
}

/**
 * Locates top folder navigation breadcrumb container
 */
function findFolderHeaderContainer() {
    const nav = document.querySelector('nav[guidedhelpid="folder_path"], nav.o-Yc');
    if (nav) {
        const parent = nav.closest('.o-Yc-j') || nav.parentElement;
        return { nav, parent };
    }
    return null;
}

/**
 * Locates bottom location status bar container when visible
 */
function findBottomStatusBarContainer() {
    const bottomRegion = document.querySelector('.LVhrj:not(.YGHoCf)');
    if (bottomRegion) {
        const nativeOl = bottomRegion.querySelector('ol[aria-label="File location"], ol.BBUN1c');
        return { nativeOl, parent: bottomRegion };
    }
    return null;
}

/**
 * Restores native elements and cleans up all custom bars
 */
function restoreNativeElements() {
    currentRenderedId = null;
    const customBars = document.querySelectorAll('.web2win-statusbar-container');
    customBars.forEach(bar => bar.remove());

    const customLoaders = document.querySelectorAll('.web2win-loader');
    customLoaders.forEach(loader => loader.remove());

    const toolbarActions = document.querySelectorAll('.web2win-toolbar-action');
    toolbarActions.forEach(action => action.remove());

    const nativeNavs = document.querySelectorAll('nav[guidedhelpid="folder_path"], nav.o-Yc, ol[aria-label="File location"], ol.BBUN1c');
    nativeNavs.forEach(nav => {
        nav.style.removeProperty('display');
    });
}

/**
 * Updates selection action toolbar (.uEnUtd) ONLY on root My Drive page when 1 item is selected
 */
function updateSelectionToolbar(settings) {
    const toolbarWrapper = document.querySelector('.uEnUtd');
    const existingToolbarBtn = document.querySelector('.web2win-toolbar-action');

    // ONLY show toolbar button on root My Drive page
    if (!settings || !settings.extensionEnabled || !isRootMyDrivePage() || !toolbarWrapper) {
        if (existingToolbarBtn) existingToolbarBtn.remove();
        return;
    }

    const selectedTarget = findSelectedFileId();
    if (!selectedTarget || !selectedTarget.fileId) {
        if (existingToolbarBtn) existingToolbarBtn.remove();
        return;
    }

    // Target container row inside .uEnUtd
    const actionRow = toolbarWrapper.querySelector('.a-s-tb-sc-Ja.a-s-tb-Kg') ||
        toolbarWrapper.querySelector('.a-s-tb-sc-Ja-J') ||
        toolbarWrapper.querySelector('.a-s-tb-sc-Ja') ||
        toolbarWrapper;

    if (!actionRow) return;

    let toolbarAction = actionRow.querySelector('.web2win-toolbar-action');
    if (toolbarAction && toolbarAction.getAttribute('data-target-id') === selectedTarget.fileId) {
        return; // already up to date for this item
    }

    if (!toolbarAction) {
        toolbarAction = document.createElement('div');
        toolbarAction.className = 'a-s-tb-sc-Ja-Q a-s-tb-sc-Ja-Q-Nm a-s-tb-Kg-Q web2win-toolbar-action';

        const innerDiv = document.createElement('div');
        innerDiv.className = 'a-s-tb-sc-Ja-Q-x a-s-tb-Kg-Q';

        const btn = document.createElement('div');
        btn.className = 'h-sb-Ic h-R-d a-c-d web2win-toolbar-btn';
        btn.setAttribute('role', 'button');
        btn.setAttribute('aria-label', 'Open Item in Windows Explorer');
        btn.setAttribute('data-tooltip', 'Open in Windows Explorer');
        btn.setAttribute('data-tooltip-align', 'b,c');
        btn.setAttribute('data-tooltip-delay', '500');
        btn.setAttribute('data-tooltip-unhoverable', 'true');
        btn.setAttribute('tabindex', '0');
        btn.style.userSelect = 'none';

        const iconContainer = document.createElement('div');
        iconContainer.className = 'c-Po a-d-c';

        const img = document.createElement('img');
        img.src = chrome.runtime.getURL('icons/icon128.png');
        img.alt = 'Open in Explorer';

        iconContainer.appendChild(img);
        btn.appendChild(iconContainer);
        innerDiv.appendChild(btn);
        toolbarAction.appendChild(innerDiv);
        actionRow.appendChild(toolbarAction);
    }

    toolbarAction.setAttribute('data-target-id', selectedTarget.fileId);

    const btn = toolbarAction.querySelector('.web2win-toolbar-btn');
    btn.onclick = async (e) => {
        e.stopPropagation();
        const currentSettings = await getSettings();
        const hierarchyData = await fetchItemHierarchy(selectedTarget.fileId);

        if (!hierarchyData || !hierarchyData.pathNodes || hierarchyData.pathNodes.length === 0) {
            alert("Failed to resolve item path.");
            return;
        }

        const { pathNodes, isMyDrive } = hierarchyData;
        const effectiveOpenMode = (!isMyDrive || currentSettings.openMode === 'shortcut') ? 'shortcut' : 'fullPath';
        const lastNode = pathNodes[pathNodes.length - 1];

        if (effectiveOpenMode === 'fullPath') {
            const fullPathParts = pathNodes.map((n, index) => index === 0 ? currentSettings.driveRootName : n.name);
            const itemFullPath = `${currentSettings.driveLetter}:\\` + fullPathParts.join('\\');

            chrome.runtime.sendMessage({
                action: "openFolder",
                folderId: lastNode.id,
                folderName: lastNode.name,
                fullPath: itemFullPath,
                openMode: "fullPath"
            }, (response) => {
                if (!response || !response.success) alert("Failed to open item in Explorer.");
            });
        } else {
            chrome.runtime.sendMessage({
                action: "openFolder",
                folderId: lastNode.id,
                folderName: lastNode.name,
                openMode: "shortcut"
            }, (response) => {
                if (!response || !response.success) alert("Failed to open item via Shortcut ID.");
            });
        }
    };
}

/**
 * Renders universal breadcrumb and action bar into a target parent container
 */
function renderCustomBar(targetParentEl, targetNavEl, pathNodes, isMyDrive, settings) {
    // Hide native navigation element safely
    if (targetNavEl) {
        targetNavEl.style.setProperty('display', 'none', 'important');
    }

    let statusBar = targetParentEl.querySelector('.web2win-statusbar-container');
    if (!statusBar) {
        statusBar = document.createElement('div');
        statusBar.className = 'web2win-statusbar-container';
        targetParentEl.appendChild(statusBar);
    }

    statusBar.innerHTML = '';

    const breadcrumbsWrapper = document.createElement('div');
    breadcrumbsWrapper.className = 'web2win-breadcrumbs-wrapper';

    const uPrefix = getUserPrefix();
    const effectiveOpenMode = (!isMyDrive || settings.openMode === 'shortcut') ? 'shortcut' : 'fullPath';

    let displayNodes = [...pathNodes];
    const depthLimit = settings.pathDepth;

    if (depthLimit > 0 && displayNodes.length > depthLimit) {
        const rootNode = displayNodes[0];
        const tailNodes = displayNodes.slice(displayNodes.length - (depthLimit - 1));
        displayNodes = [rootNode, { id: null, name: '...', isEllipsis: true }, ...tailNodes];
    }

    displayNodes.forEach((node, idx) => {
        if (idx > 0) {
            const sep = document.createElement('span');
            sep.className = 'web2win-separator';
            sep.textContent = '>';
            breadcrumbsWrapper.appendChild(sep);
        }

        const capsule = document.createElement(node.isFolder && node.id ? 'a' : 'span');
        capsule.className = 'web2win-capsule';

        if (node.isFolder && node.id) {
            capsule.classList.add('web2win-folder-capsule');
            capsule.href = `https://drive.google.com/drive${uPrefix}/folders/${node.id}`;
            capsule.title = `Open folder: ${node.name}`;
        }

        const textSpan = document.createElement('span');
        textSpan.textContent = (idx === 0 && isMyDrive && node.name === 'root') ? settings.driveRootName : node.name;
        capsule.appendChild(textSpan);
        breadcrumbsWrapper.appendChild(capsule);
    });

    statusBar.appendChild(breadcrumbsWrapper);

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'web2win-actions-container';

    const lastNode = pathNodes[pathNodes.length - 1];

    // 1. Copy Path Button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'web2win-action-btn';
    copyBtn.title = effectiveOpenMode === 'fullPath' ? 'Copy Full Path' : 'Copy Shortcut Path';
    copyBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;

    copyBtn.onclick = (e) => {
        e.stopPropagation();
        let targetCopyPath = '';
        if (effectiveOpenMode === 'fullPath') {
            const pathParts = pathNodes.map((n, index) => index === 0 ? settings.driveRootName : n.name);
            targetCopyPath = `${settings.driveLetter}:\\` + pathParts.join('\\');
        } else {
            targetCopyPath = `${settings.driveLetter}:\\.shortcut-targets-by-id\\${lastNode.id}\\${lastNode.name}`;
        }

        navigator.clipboard.writeText(targetCopyPath).then(() => {
            showToast(`Copied path: ${targetCopyPath}`);
        });
    };

    // 2. Open Item/Folder in Explorer Button
    const explorerBtn = document.createElement('button');
    explorerBtn.className = 'web2win-action-btn';
    explorerBtn.title = effectiveOpenMode === 'fullPath' ? 'Open Item in Windows Explorer (Full Path)' : 'Open Item in Windows Explorer (Shortcut ID)';

    const explorerImg = document.createElement('img');
    explorerImg.src = chrome.runtime.getURL('icons/icon128.png');
    explorerImg.alt = 'Open in Explorer';
    explorerBtn.appendChild(explorerImg);

    explorerBtn.onclick = (e) => {
        e.stopPropagation();
        if (effectiveOpenMode === 'fullPath') {
            const fullPathParts = pathNodes.map((n, index) => index === 0 ? settings.driveRootName : n.name);
            const itemFullPath = `${settings.driveLetter}:\\` + fullPathParts.join('\\');

            chrome.runtime.sendMessage({
                action: "openFolder",
                folderId: lastNode.id,
                folderName: lastNode.name,
                fullPath: itemFullPath,
                openMode: "fullPath"
            }, (response) => {
                if (!response || !response.success) alert("Failed to open item in Explorer.");
            });
        } else {
            chrome.runtime.sendMessage({
                action: "openFolder",
                folderId: lastNode.id,
                folderName: lastNode.name,
                openMode: "shortcut"
            }, (response) => {
                if (!response || !response.success) alert("Failed to open item via Shortcut ID.");
            });
        }
    };

    actionsContainer.appendChild(copyBtn);
    actionsContainer.appendChild(explorerBtn);
    statusBar.appendChild(actionsContainer);

    requestAnimationFrame(() => {
        breadcrumbsWrapper.scrollLeft = breadcrumbsWrapper.scrollWidth;
    });
}

let isUpdating = false;
let debounceTimer = null;

function debouncedUpdateBreadcrumbBar() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        updateBreadcrumbBar();
    }, 50);
}

/**
 * Unified Controller for Breadcrumbs and Selection Toolbar
 */
async function updateBreadcrumbBar() {
    if (isUpdating) return;
    isUpdating = true;

    try {
        const settings = await getSettings();

        // If extension is disabled in settings, restore native UI immediately
        if (!settings.extensionEnabled) {
            restoreNativeElements();
            return;
        }

        // Always check and update selection action toolbar (.uEnUtd)
        updateSelectionToolbar(settings);

        // If on Root My Drive page, only selection toolbar is used
        if (isRootMyDrivePage()) {
            return;
        }

        // Check if hidden bottom bar exists and clean it up
        const hiddenBottomBar = document.querySelector('.LVhrj.YGHoCf');
        if (hiddenBottomBar) {
            const customBarInHidden = hiddenBottomBar.querySelector('.web2win-statusbar-container');
            if (customBarInHidden) customBarInHidden.remove();
        }

        const activeId = findActiveTargetId();
        const folderHeader = findFolderHeaderContainer();
        const bottomBar = findBottomStatusBarContainer();

        if (!activeId) {
            restoreNativeElements();
            return;
        }

        // Targets where we can inject our universal bar
        const targets = [];
        if (folderHeader) {
            targets.push({ nav: folderHeader.nav, parent: folderHeader.parent });
        }
        if (bottomBar) {
            targets.push({ nav: bottomBar.nativeOl, parent: bottomBar.parent });
        }

        if (targets.length === 0) {
            return;
        }

        // If activeId already rendered in all visible target parents, skip
        const allAlreadyRendered = targets.every(t =>
            currentRenderedId === activeId && t.parent.querySelector('.web2win-statusbar-container')
        );
        if (allAlreadyRendered) {
            return;
        }

        currentRenderedId = activeId;

        // Instantly append loader while fetching hierarchy
        targets.forEach(t => {
            if (t.nav && !t.parent.querySelector('.web2win-statusbar-container')) {
                let loader = t.parent.querySelector('.web2win-loader');
                if (!loader) {
                    loader = document.createElement('img');
                    loader.className = 'web2win-loader';
                    loader.src = chrome.runtime.getURL('icons/loading.gif');
                    loader.style.cssText = 'width: 18px; height: 18px; margin-left: 8px; vertical-align: middle; flex-shrink: 0;';
                    t.parent.appendChild(loader);
                }
            }
        });

        const hierarchyData = await fetchItemHierarchy(activeId);

        // Remove loaders
        targets.forEach(t => {
            const loader = t.parent.querySelector('.web2win-loader');
            if (loader) loader.remove();
        });

        if (!hierarchyData || !hierarchyData.pathNodes || hierarchyData.pathNodes.length === 0) {
            gWarn("No hierarchy data found for ID:", activeId);
            return;
        }

        const { pathNodes, isMyDrive } = hierarchyData;

        // Render universal bar into all available target containers
        targets.forEach(t => {
            renderCustomBar(t.parent, t.nav, pathNodes, isMyDrive, settings);
        });

    } finally {
        isUpdating = false;
    }
}

// Listen for instant settings changes across all tabs without reload
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
        gLog("Settings changed dynamically:", changes);
        currentRenderedId = null; // force re-render
        if (changes.extensionEnabled && !changes.extensionEnabled.newValue) {
            restoreNativeElements();
        } else {
            debouncedUpdateBreadcrumbBar();
        }
    }
});

// Observe DOM mutations for URL changes, selection changes, and toolbar / bottom bar appearance
const observer = new MutationObserver(() => {
    debouncedUpdateBreadcrumbBar();
});

observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-selected', 'class']
});

// Initial run
debouncedUpdateBreadcrumbBar();
