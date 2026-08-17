// In-memory cache for individual node metadata with 3-minute TTL
const nodeCache = new Map();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
let cachedUserRootId = null;

function getCachedNode(id) {
    if (nodeCache.has(id)) {
        const entry = nodeCache.get(id);
        if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
            return entry.node;
        }
        nodeCache.delete(id);
    }
    return null;
}

function setCachedNode(id, node) {
    nodeCache.set(id, { node: node, timestamp: Date.now() });
}

/**
 * Gets OAuth Access Token from chrome.identity API
 */
function getAuthTokenInteractive() {
    return new Promise((resolve) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError) {
                console.error("[GDrive-Tim Background] chrome.identity error:", chrome.runtime.lastError.message);
                resolve(null);
            } else {
                console.log("[GDrive-Tim Background] OAuth Token retrieved successfully!");
                resolve(token);
            }
        });
    });
}

/**
 * Fetches and caches the user's My Drive root folder ID
 */
async function getUserRootId(token) {
    if (cachedUserRootId) return cachedUserRootId;
    try {
        const resp = await fetch('https://www.googleapis.com/drive/v3/files/root?fields=id,name', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resp.ok) {
            const data = await resp.json();
            if (data && data.id) {
                cachedUserRootId = data.id;
                console.log("[GDrive-Tim Background] User root folder ID cached:", cachedUserRootId);
                return cachedUserRootId;
            }
        }
    } catch (e) {
        console.warn("[GDrive-Tim Background] Failed to fetch root folder ID:", e);
    }
    return null;
}

// Listen for messages from contentScript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "openFolder") {
        const { folderId, folderName, fullPath, openModeOverride, openMode } = request;

        console.log(`[GDrive-Tim Background] Received request to open: ${folderName} (ID: ${folderId})`);

        chrome.storage.local.get(['driveLetter', 'openMode'], (result) => {
            const driveLetter = result.driveLetter || 'G';
            const targetOpenMode = openModeOverride || openMode || result.openMode || 'fullPath';
            const hostName = "com.google_drive_to_explorer";

            chrome.runtime.sendNativeMessage(hostName, {
                folderId: folderId,
                folderName: folderName,
                driveLetter: driveLetter,
                fullPath: fullPath,
                openMode: targetOpenMode
            },
                function (response) {
                    if (chrome.runtime.lastError) {
                        console.error("[GDrive-Tim Background] Native Messaging Error:", chrome.runtime.lastError.message);
                        sendResponse({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        console.log("[GDrive-Tim Background] Native Host Response:", response);
                        sendResponse({ success: true, response: response });
                    }
                });
        });

        return true;
    }

    if (request.action === "fetchHierarchy") {
        const { fileId } = request;
        console.log(`[GDrive-Tim Background] fetchHierarchy requested for ID: ${fileId}`);

        (async () => {
            const token = await getAuthTokenInteractive();
            if (!token) {
                console.error("[GDrive-Tim Background] Unable to obtain OAuth token via chrome.identity.");
                sendResponse({ success: false, error: "OAuth token not available" });
                return;
            }

            const rootId = await getUserRootId(token);
            const pathNodes = [];
            let currentId = fileId;
            let iterations = 0;

            while (currentId && iterations < 15) {
                iterations++;

                // Check cache first with TTL
                const cachedNode = getCachedNode(currentId);
                if (cachedNode) {
                    pathNodes.push(cachedNode);
                    if (cachedNode.parents && cachedNode.parents.length > 0) {
                        currentId = cachedNode.parents[0];
                    } else {
                        break;
                    }
                    continue;
                }

                const apiUrl = `https://www.googleapis.com/drive/v3/files/${currentId}?fields=id,name,parents,mimeType,driveId,iconLink,folderColorRgb,shared`;

                try {
                    const resp = await fetch(apiUrl, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (!resp.ok) {
                        const errText = await resp.text();
                        console.error("[GDrive-Tim Background] API returned error body:", errText);
                        break;
                    }

                    const data = await resp.json();
                    const node = {
                        id: data.id,
                        name: data.name || 'Untitled',
                        isFolder: data.mimeType === 'application/vnd.google-apps.folder',
                        parents: (data.parents || []).map(p => typeof p === 'object' ? p.id : p),
                        driveId: data.driveId || null,
                        iconLink: data.iconLink || null,
                        folderColorRgb: data.folderColorRgb || null,
                        shared: data.shared === true
                    };

                    setCachedNode(currentId, node);
                    pathNodes.push(node);

                    if (node.parents && node.parents.length > 0) {
                        currentId = node.parents[0];
                    } else {
                        break;
                    }
                } catch (e) {
                    console.error("[GDrive-Tim Background] Exception during fetch:", e);
                    break;
                }
            }

            pathNodes.reverse();

            // Item is in My Drive if root node matches the user's root ID, or has no parent/driveId
            let isMyDrive = false;
            if (pathNodes.length > 0) {
                const rootNode = pathNodes[0];
                if (rootId && rootNode.id === rootId) {
                    isMyDrive = true;
                } else if (!rootNode.driveId && (rootNode.name === 'My Drive' || rootNode.name === 'Мій Диск' || (rootNode.parents && rootNode.parents.length === 0 && !rootId))) {
                    isMyDrive = true;
                }
            }

            console.log(`[GDrive-Tim Background] Built path hierarchy (${pathNodes.length} nodes, isMyDrive: ${isMyDrive}):`, pathNodes);
            sendResponse({ success: true, pathNodes: pathNodes, isMyDrive: isMyDrive });
        })();

        return true;
    }
});
