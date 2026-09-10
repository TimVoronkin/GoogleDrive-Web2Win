import sys
import json
import struct
import subprocess
import os

def receive_message():
    """Reads a message from stdin with the format: length (4 bytes) + JSON string."""
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None
    message_length = struct.unpack('=I', raw_length)[0]
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)

def send_message(message_content):
    """Sends a message to stdout with the format: length (4 bytes) + JSON string."""
    encoded_content = json.dumps(message_content).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('=I', len(encoded_content)))
    sys.stdout.buffer.write(encoded_content)
    sys.stdout.buffer.flush()

def main():
    while True:
        try:
            message = receive_message()
            if not message:
                break
            
            action = message.get("action")
            if action == "detectConfig":
                try:
                    from detect_drive import detect_google_drive
                    config = detect_google_drive()
                    send_message({"status": "ok", **config})
                except Exception as ex:
                    # Fallback to reading config.json if import fails
                    config_file = os.path.join(os.path.dirname(__file__), "config.json")
                    if os.path.exists(config_file):
                        with open(config_file, "r", encoding="utf-8") as f:
                            data = json.load(f)
                        send_message({"status": "ok", **data})
                    else:
                        send_message({"status": "error", "error": str(ex)})
                continue

            folder_id = message.get("folderId")
            folder_name = message.get("folderName")
            drive_letter = message.get("driveLetter", "G")
            full_path = message.get("fullPath")
            open_mode = message.get("openMode", "fullPath")
            
            target_path = None

            if open_mode == "fullPath" and full_path:
                target_path = full_path
            elif folder_id and folder_name:
                target_path = f"{drive_letter}:\\.shortcut-targets-by-id\\{folder_id}\\{folder_name}"
            elif full_path:
                target_path = full_path

            if target_path:
                send_message({"status": "Opening", "path": target_path})
                subprocess.Popen(['explorer', target_path])
            else:
                send_message({"error": "Missing folderId, folderName or fullPath"})
                
        except Exception as e:
            send_message({"error": str(e)})

if __name__ == '__main__':
    main()
