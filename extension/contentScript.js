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
        chrome.storage.local.get(['driveLetter', 'driveRootName', 'pathDepth', 'openMode', 'enableLogging'], (result) => {
            isLoggingEnabled = result.enableLogging !== undefined ? result.enableLogging : true;
            const settings = {
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
 * Finds currently selected file ID in Google Drive view
 */
function findSelectedFileId() {
    const selectedEls = document.querySelectorAll('[aria-selected="true"]');

    if (selectedEls.length === 0) return null;

    for (const el of selectedEls) {
        let fileId = el.getAttribute('data-id');

        if (!fileId) {
            const childWithId = el.querySelector('[data-id]');
            if (childWithId) fileId = childWithId.getAttribute('data-id');
        }

        if (!fileId) {
            const parentWithId = el.closest('[data-id]');
            if (parentWithId) fileId = parentWithId.getAttribute('data-id');
        }

        if (fileId) {
            const fileNameEl = el.querySelector('.MxB3Nd') || el.querySelector('[data-tooltip]') || el;
            const fileName = fileNameEl ? fileNameEl.textContent.trim() : 'File';
            return { fileId, fileName, element: el };
        }
    }

    return null;
}

/**
 * Locates top folder navigation breadcrumb container
 */
function findFolderHeaderContainer() {
    const nav = document.querySelector('nav[guidedhelpid="folder_path"]') || document.querySelector('.o-Yc');
    if (nav) {
        const parent = nav.closest('.o-Yc-j') || nav.parentElement;
        return { nav, parent };
    }

    const myDriveToolbar = document.querySelector('.a-s-tb-sc-Ja-Q-pa') || document.querySelector('.a-s-tb-sc-Ja-Q-x') || document.querySelector('.a-s-Ba-Cm');
    if (myDriveToolbar) {
        return { nav: null, parent: myDriveToolbar };
    }

    return null;
}

/**
 * Locates bottom location status bar container
 */
function findBottomStatusBarContainer() {
    const nativeOl = document.querySelector('ol[aria-label="File location"]') || document.querySelector('ol.BBUN1c');
    if (nativeOl) {
        const parent = nativeOl.closest('.LVhrj') || nativeOl.parentElement;
        return { nativeOl, parent };
    }
    return null;
}

/**
 * Restores native elements when no selection or folder is active
 */
function restoreNativeElements() {
    currentRenderedId = null;
    const customBars = document.querySelectorAll('.web2win-statusbar-container');
    customBars.forEach(bar => bar.remove());

    const nativeNavs = document.querySelectorAll('nav[guidedhelpid="folder_path"], .o-Yc, ol[aria-label="File location"], ol.BBUN1c');
    nativeNavs.forEach(nav => {
        nav.style.removeProperty('display');
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
 * Unified Breadcrumbs & Actions Controller
 */
async function updateBreadcrumbBar() {
    if (isUpdating) return;
    isUpdating = true;

    try {
        const selected = findSelectedFileId();
        const urlMatch = window.location.href.match(/\/folders\/([a-zA-Z0-9_-]+)/);
        const isMyDrivePage = window.location.href.includes('/my-drive');

        let activeId = null;

        if (selected) {
            activeId = selected.fileId;
        } else if (urlMatch) {
            activeId = urlMatch[1];
        } else if (isMyDrivePage) {
            activeId = 'root';
        }

        if (!activeId) {
            restoreNativeElements();
            return;
        }

        const folderHeader = findFolderHeaderContainer();
        const bottomBar = findBottomStatusBarContainer();

        let targetNavEl = null;
        let targetParentEl = null;

        if (folderHeader) {
            targetNavEl = folderHeader.nav;
            targetParentEl = folderHeader.parent;
        } else if (bottomBar) {
            targetNavEl = bottomBar.nativeOl;
            targetParentEl = bottomBar.parent;
        }

        if (!targetParentEl) return;

        if (currentRenderedId === activeId && targetParentEl.querySelector('.web2win-statusbar-container')) {
            return; // Already rendered for current active ID
        }

        currentRenderedId = activeId;

        // Instantly append loader while fetching hierarchy
        if (targetNavEl && !targetParentEl.querySelector('.web2win-statusbar-container')) {
            let loader = targetParentEl.querySelector('.web2win-loader');
            if (!loader) {
                loader = document.createElement('img');
                loader.className = 'web2win-loader';
                loader.src = chrome.runtime.getURL('icons/loading.gif');
                loader.style.cssText = 'width: 18px; height: 18px; margin-left: 8px; vertical-align: middle; flex-shrink: 0;';
                targetParentEl.appendChild(loader);
            }
        }

        const hierarchyData = await fetchItemHierarchy(activeId);

        const loader = targetParentEl.querySelector('.web2win-loader');
        if (loader) loader.remove();

        if (!hierarchyData || !hierarchyData.pathNodes || hierarchyData.pathNodes.length === 0) {
            gWarn("No hierarchy data found for ID:", activeId);
            return;
        }

        const { pathNodes, isMyDrive } = hierarchyData;
        const settings = await getSettings();

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

        if (isMyDrive) {
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

                const capsule = document.createElement(node.isFolder ? 'a' : 'span');
                capsule.className = 'web2win-capsule';

                if (node.isFolder && node.id) {
                    capsule.classList.add('web2win-folder-capsule');
                    capsule.href = `https://drive.google.com/drive${uPrefix}/folders/${node.id}`;
                    capsule.title = `Open folder: ${node.name}`;
                }

                const textSpan = document.createElement('span');
                textSpan.textContent = node.name;
                capsule.appendChild(textSpan);
                breadcrumbsWrapper.appendChild(capsule);
            });
        } else {
            pathNodes.forEach((node, idx) => {
                if (idx > 0) {
                    const sep = document.createElement('span');
                    sep.className = 'web2win-separator';
                    sep.textContent = '>';
                    breadcrumbsWrapper.appendChild(sep);
                }
                const capsule = document.createElement('span');
                capsule.className = 'web2win-capsule';
                capsule.textContent = node.name;
                breadcrumbsWrapper.appendChild(capsule);
            });
        }

        statusBar.appendChild(breadcrumbsWrapper);

        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'web2win-actions-container';

        // 1. Copy Path Button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'web2win-action-btn';
        copyBtn.title = isMyDrive ? 'Copy Full Path' : 'Copy Shortcut Path';
        copyBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;

        copyBtn.onclick = (e) => {
            e.stopPropagation();
            let targetCopyPath = '';
            if (isMyDrive) {
                const pathParts = pathNodes.map((n, index) => index === 0 ? settings.driveRootName : n.name);
                targetCopyPath = `${settings.driveLetter}:\\` + pathParts.join('\\');
            } else {
                const targetNode = pathNodes[pathNodes.length - 1];
                targetCopyPath = `${settings.driveLetter}:\\.shortcut-targets-by-id\\${targetNode.id}\\${targetNode.name}`;
            }

            navigator.clipboard.writeText(targetCopyPath).then(() => {
                showToast(`Copied path: ${targetCopyPath}`);
            });
        };

        // 2. Open Item/Folder in Explorer Button
        const explorerBtn = document.createElement('button');
        explorerBtn.className = 'web2win-action-btn';
        explorerBtn.title = 'Open Item in Windows Explorer';

        const explorerImg = document.createElement('img');
        explorerImg.src = chrome.runtime.getURL('icons/icon128.png');
        explorerImg.alt = 'Open in Explorer';
        explorerBtn.appendChild(explorerImg);

        explorerBtn.onclick = (e) => {
            e.stopPropagation();
            const lastNode = pathNodes[pathNodes.length - 1];

            if (isMyDrive) {
                const fullPathParts = pathNodes.map((n, index) => index === 0 ? settings.driveRootName : n.name);
                const itemFullPath = `${settings.driveLetter}:\\` + fullPathParts.join('\\');

                chrome.runtime.sendMessage({
                    action: "openFolder",
                    folderId: lastNode.id,
                    folderName: lastNode.name,
                    fullPath: itemFullPath,
                    openModeOverride: "fullPath"
                }, (response) => {
                    if (!response || !response.success) alert("Failed to open item in Explorer.");
                });
            } else {
                chrome.runtime.sendMessage({
                    action: "openFolder",
                    folderId: lastNode.id,
                    folderName: lastNode.name,
                    openModeOverride: "shortcut"
                }, (response) => {
                    if (!response || !response.success) alert("Failed to open shared item.");
                });
            }
        };

        actionsContainer.appendChild(copyBtn);
        actionsContainer.appendChild(explorerBtn);
        statusBar.appendChild(actionsContainer);

        requestAnimationFrame(() => {
            breadcrumbsWrapper.scrollLeft = breadcrumbsWrapper.scrollWidth;
        });
    } finally {
        isUpdating = false;
    }
}

// Observe DOM mutations for URL changes and selection changes
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
