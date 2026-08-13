# <img src="extension/icons/icon128.png" valign="middle" alt="icon" width="64" height="64"> GoogleDrive-Web2Win

**GoogleDrive-Web2Win** is a Chrome extension that allows you to open your currently viewed Google Drive folder directly in standard Windows Explorer and displays full path breadcrumbs for search results with quick action buttons.

## Features
- **Open Current Folder in Explorer**: Adds a button to the Google Drive header to open the currently viewed folder in Windows Explorer.
- **Full Path Breadcrumb Capsules**: Displays interactive breadcrumb pills for selected items in Google Drive search results. Click any parent folder to navigate directly to it in Drive.
- **Copy Full Windows Path**: One-click icon to copy the selected item's full Windows path (`G:\My Drive\Folder\file.jpg`) directly to your clipboard.
- **Open Parent Folder in Explorer**: Quick button in the search status bar to open the parent folder of the selected file in Windows Explorer.
- **Customizable Popup Settings**:
  - **Disk Letter**: Choose drive letter (e.g. `G:`).
  - **Drive Root Folder Name**: Set custom root folder name (e.g. `My Drive`, `Мій Диск`).
  - **Max Path Depth**: Limit displayed breadcrumb depth (e.g., 1–10 levels or full path).

## Requirements
- **OS**: Windows 10/11
- [Google Drive for Desktop](https://www.google.com/drive/download/) installed and running.
- [Python 3.x](https://www.python.org/downloads/) installed (make sure to add Python to PATH).

## Installation

### 1. Install Extension in Chrome
1. Download or clone this repository.
2. Open Chrome and navigate to [`chrome://extensions/`](chrome://extensions/).
3. Enable **Developer mode** (toggle in the top right).
4. Click **Load unpacked** and select the [`extension`](./extension) folder from this repository.

### 2. Register Native Host
1. Navigate to the [`native_host`](./native_host) folder.
2. Double-click [`install_host.bat`](./native_host/install_host.bat).
3. Press **Enter** to accept the default Extension ID (or paste a custom ID if modified).
4. The installer will register the Native Host in Windows Registry automatically.

### 3. Configure Settings
1. Click on the extension icon in the browser action bar.
2. Select your **Disk Letter** (default: `G:`).
3. Set your **Drive Root Folder Name** (e.g., `My Drive` or `Мій Диск`).
4. Set your desired **Max Path Depth** for search results.

## Usage
1. Open [Google Drive](https://drive.google.com) in Chrome.
2. Select any file or folder in search results to view its full path capsules at the bottom.
3. Click the copy icon to copy `G:\My Drive\...` to your clipboard, or click the Explorer icon to open its parent folder on Windows!

