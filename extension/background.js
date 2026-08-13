// In-memory cache for individual node metadata with 3-minute TTL
const nodeCache = new Map();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

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

// Listen for messages from contentScript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "openFolder") {
        const { folderId, folderName, fullPath, openModeOverride } = request;

        console.log(`[GDrive-Tim Background] Received request to open: ${folderName} (ID: ${folderId})`);

        chrome.storage.local.get(['driveLetter', 'openMode'], (result) => {
            const driveLetter = result.driveLetter || 'G';
            const openMode = openModeOverride || result.openMode || 'fullPath';
            const hostName = "com.google_drive_to_explorer";

            chrome.runtime.sendNativeMessage(hostName, {
                folderId: folderId,
                folderName: folderName,
                driveLetter: driveLetter,
                fullPath: fullPath,
                openMode: openMode
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

                const apiUrl = `https://www.googleapis.com/drive/v3/files/${currentId}?fields=id,name,parents,mimeType,driveId`;

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
                        driveId: data.driveId || null
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

            // Item is in My Drive if root node has no driveId (Shared Drive ID)
            const isMyDrive = pathNodes.length > 0 && !pathNodes[0].driveId;

            console.log(`[GDrive-Tim Background] Built path hierarchy (${pathNodes.length} nodes, isMyDrive: ${isMyDrive}):`, pathNodes);
            sendResponse({ success: true, pathNodes: pathNodes, isMyDrive: isMyDrive });
        })();

        return true;
    }
});



