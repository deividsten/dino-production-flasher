"""Device detection and serial communication logic for the DinoCore Production Flasher."""

import time
import serial
import threading
import re
from serial.tools.list_ports import comports
from ..utils.config import MONITOR_BAUD


def get_esp32_port(log_queue):
    """Scans COM ports and identifies the one connected to an ESP32 using VID/PID."""
    esp32_ports = [p for p in comports() if "303A:1001" in p.hwid]

    if not esp32_ports:
        return None, "NO_ESP32_FOUND"
    
    if len(esp32_ports) > 1:
        return None, "MULTIPLE_ESP32_FOUND"

    port = esp32_ports[0].device
    return port, "ESP32_FOUND"


def serial_monitor_thread(log_queue, port, stop_event, app_instance):
    """Thread function to monitor the serial port."""
    try:
        ser = serial.Serial(port, MONITOR_BAUD, timeout=1)
        log_queue.put(f"--- Serial monitor started for {port} ---")
        mac_address = None
        device_name = None
        while not stop_event.is_set():
            try:
                if ser.in_waiting > 0:
                    line_bytes = ser.readline()
                    line = line_bytes.decode('utf-8', errors='replace')
                    log_queue.put(line)

                    # Capture MAC and Name
                    if "Bluetooth MAC:" in line:
                        mac_match = re.search(r'Bluetooth MAC: ([0-9A-Fa-f:]{17}|[0-9A-Fa-f-]{17})', line)
                        if mac_match:
                            mac_address = mac_match.group(1).strip().upper()
                            log_queue.put(f"📱 Captured Bluetooth MAC: {mac_address}")

                    if "Setting device name to:" in line:
                        name_match = re.search(r'Setting device name to: (.+)', line)
                        if name_match:
                            device_name = name_match.group(1).strip()
                            log_queue.put(f"📱 Captured Bluetooth Name: {device_name}")

                    if "The device is now discoverable and ready for connection!" in line:
                        if mac_address and device_name:
                            app_instance.set_captured_ble_details(mac_address, device_name)
                            mac_address, device_name = None, None # Reset
                else:
                    time.sleep(0.05)
                    if not any(p.device == port for p in comports()):
                        log_queue.put(f"\n--- Device {port} disconnected. Closing monitor. ---")
                        break
            except serial.SerialException:
                log_queue.put(f"\n--- Device {port} disconnected. Closing monitor. ---")
                break
        ser.close()
        log_queue.put(f"--- Serial monitor for {port} stopped. ---")
    except Exception as e:
        log_queue.put(f"\n[X] Error opening serial monitor on {port}: {e}")


def process_device_thread(log_queue, port, mode, stop_event, target_hw_version, app_instance, skip_efuse_read=False):
    """Thread function to process a device (flash, read eFuse, etc.)."""
    import time
    import traceback
    from ..business_logic.firmware import burn_efuse, read_efuse_version, flash_device
    from ..utils.config import ERROR_FREQ, ERROR_DUR
    from ..utils.helpers import play_sound
    
    start_time = time.time()
    device_info = {'port': port, 'serial_number': 'unknown'}
    flash_result = {
        'success': False,
        'mode': mode,
        'hardware_version': target_hw_version,
        'error': ''
    }

    try:
        log_queue.put(f"--- Processing new device on {port} ---")
        flash_hw_version = None
        if mode == 'testing':
            log_queue.put(f"Attempting to burn eFuse with version {target_hw_version}...")
            burn_successful = burn_efuse(log_queue, port, target_hw_version)
            if burn_successful:
                log_queue.put("Burn command succeeded. Verifying by reading back eFuse...")
                time.sleep(2)  # Increased delay for device stabilization
                read_version = read_efuse_version(log_queue, port)
                if read_version == target_hw_version:
                    log_queue.put(f"[OK] Verification successful. Version {read_version} is burned.")
                    flash_hw_version = target_hw_version
                    log_queue.put("eFuse burning completed successfully. Starting firmware flash...")
                else:
                    log_queue.put(f"[X] VERIFICATION FAILED. Burned version ({read_version}) does not match target ({target_hw_version}). Stopping.")
                    play_sound(ERROR_FREQ, ERROR_DUR)
                    return
            else:
                log_queue.put("Burn command failed. Attempting to read existing version...")
                existing_version = read_efuse_version(log_queue, port)
                if existing_version:
                    log_queue.put(f"Proceeding with existing version: {existing_version}")
                    flash_hw_version = existing_version
                else:
                    log_queue.put("[X] Could not read existing version after burn failure. Stopping.")
                    play_sound(ERROR_FREQ, ERROR_DUR)
                    return
        elif mode == 'production':
            if skip_efuse_read:
                log_queue.put("Production mode: Skipping eFuse read (automatic flash after QC)...")
                # Use the target hardware version directly since device was already verified
                flash_hw_version = target_hw_version
                log_queue.put(f"Using verified hardware version: {target_hw_version}. Starting firmware flash...")
            else:
                log_queue.put("Production mode: Reading eFuse...")
                existing_version = read_efuse_version(log_queue, port)
                if existing_version:
                    flash_hw_version = existing_version
                    log_queue.put(f"Found eFuse version: {existing_version}. Starting firmware flash...")
                else:
                    log_queue.put("[X] PRODUCTION FAILED: No eFuse version found. Please run device through Testing Mode first.")
                    play_sound(ERROR_FREQ, ERROR_DUR)
                    return

        # If we have a firmware version to flash, proceed with flashing
        if flash_hw_version:
            log_queue.put(f"-- Starting {mode} flash for HW {flash_hw_version} on {port} --")
            flash_ok = flash_device(log_queue, port, mode, flash_hw_version)
            if flash_ok:
                log_queue.put("Flash completed successfully. Starting serial monitor...")
                flash_result['success'] = True
                # Create a new stop event for the serial monitor thread
                monitor_stop_event = threading.Event()
                serial_monitor_thread(log_queue, port, monitor_stop_event, app_instance)
            else:
                log_queue.put("[X] Flash failed. Unable to complete device programming.")
                flash_result['error'] = "Flash process failed"
                play_sound(ERROR_FREQ, ERROR_DUR)
        else:
            log_queue.put("[X] No valid hardware version found. Cannot proceed with flash.")
            flash_result['error'] = "No valid hardware version found"
            play_sound(ERROR_FREQ, ERROR_DUR)

    except Exception as e:
        flash_result['error'] = str(e)
        log_queue.put("!!!!!!!!!! UNEXPECTED ERROR in device processing thread !!!!!!!!!!!")
        log_queue.put(f"ERROR: {e}")
        log_queue.put(traceback.format_exc() + "\n")
        play_sound(ERROR_FREQ, ERROR_DUR)
    finally:
        flash_result['duration'] = time.time() - start_time
        # Store logs to Firebase if available (would need to import the function)
        # if FIREBASE_AVAILABLE:
        #     store_flash_log(device_info, flash_result)
        #     # Also store the full session log
        #     if app_instance.session_logs:
        #         store_session_log(app_instance.session_logs)