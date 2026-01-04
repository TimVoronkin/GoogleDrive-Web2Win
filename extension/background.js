// background.js

// Listen for messages from contentScript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "openFolder") {
        const { folderId, folderName } = request;

        console.log(`Received request to open: ${folderName} (ID: ${folderId})`);

        // Connect to the Native Host application
        // The name must match the "name" in com.google_drive_to_explorer.json
        const hostName = "com.google_drive_to_explorer";

        // Use sendNativeMessage for a one-off message
        chrome.runtime.sendNativeMessage(hostName, {
            folderId: folderId,
            folderName: folderName
        },
            function (response) {
                if (chrome.runtime.lastError) {
                    console.error("Native Messaging Error:", chrome.runtime.lastError.message);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    console.log("Native Host Response:", response);
                    sendResponse({ success: true, response: response });
                }
            });

        // Return true to indicate we wish to send a response asynchronously
        return true;
    }
});
