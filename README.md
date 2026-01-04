# <img src="extension/icons/icon48.png" valign="middle" alt="icon" width="32" height="32"> GoogleDrive-Web2Win

**GoogleDrive-Web2Win** is a Chrome extension that allows you to open your currently viewed Google Drive folder directly in standard Windows Explorer. This bridges the gap between the web interface and your local file system, making file management seamless.

## Features
-   Adds a button to the Google Drive web interface.
-   Opens the corresponding folder on your local drive (mounted via Google Drive for Desktop).

## Requirements
-   **OS**: Windows 10/11
-   **Software**:
    -   [Google Drive for Desktop](https://www.google.com/drive/download/) installed and running.
    -   [Python 3.x](https://www.python.org/downloads/) installed (make sure to add Python to PATH).

## Installation

### 1. Install External Extension
1.  Download or clone this repository.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** (toggle in the top right).
4.  Click **Load unpacked**.
5.  Select the `extension` folder from this repository.
6.  **Copy the generated Extension ID** (you will need this for the next step).

### 2. Register Native Host
1.  Navigate to the `native_host` folder in this repository.
2.  Double-click `install_host.bat`.
3.  When prompted, paste the **Extension ID** you copied earlier and press Enter.
4.  The script will register the native messaging host required for the extension to communicate with Windows.

### 3. Set Disk Letter
1.  Click on the icon of the extension on browser action bar.
2.  A popup will open where you can **select the disk letter that Google Drive uses on your system**.

## Usage
1.  Open Google Drive in Chrome (`drive.google.com`).
2.  Navigate to any folder.
3.  Click the <img src="extension/icons/icon48.png" valign="middle" alt="icon" width="32" height="32"> icon.
4.  The folder should open in a new Windows Explorer window.
