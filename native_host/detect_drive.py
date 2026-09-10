import os
import sys
import json
import ctypes

def detect_google_drive():
    """Detects Google Drive Desktop installation, drive letter, and root folder name on Windows."""
    detected_drive = None
    detected_root = None

    try:
        # Get bitmask of logical drives in Windows
        bitmask = ctypes.cdll.kernel32.GetLogicalDrives()
        for i in range(26):
            if bitmask & (1 << i):
                letter = chr(65 + i)
                drive_path = f"{letter}:\\"

                # Check signature folder created by Google Drive Desktop
                shortcut_dir = os.path.join(drive_path, ".shortcut-targets-by-id")
                if os.path.exists(shortcut_dir):
                    detected_drive = letter

                    # Scan for user root directory (e.g., 'My Drive', 'Мій диск', 'Mon Drive')
                    try:
                        entries = os.listdir(drive_path)
                        for entry in entries:
                            if entry.startswith('.') or entry.startswith('$'):
                                continue
                            full_path = os.path.join(drive_path, entry)
                            if os.path.isdir(full_path):
                                detected_root = entry
                                break
                    except Exception:
                        pass
                    break
    except Exception as e:
        pass

    result = {
        "installed": detected_drive is not None,
        "driveLetter": detected_drive or "G",
        "driveRootName": detected_root or "My Drive"
    }

    return result

def save_config(config_data):
    """Saves detection result to config.json alongside script."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    config_path = os.path.join(script_dir, "config.json")
    try:
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config_data, f, ensure_ascii=False, indent=4)
    except Exception as e:
        pass

if __name__ == "__main__":
    res = detect_google_drive()
    save_config(res)
    # Print JSON with utf-8 encoding for batch/CLI scripts
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(res, ensure_ascii=False))
