"""Firmware handling logic for the DinoCore Production Flasher."""

import os
import sys
import subprocess
import requests
import time
import re
from ..utils.config import DINOCORE_BASE_URL, FIRMWARE_DIR, TESTING_FIRMWARE_DIR, FLASH_BAUD
from ..utils.helpers import parse_version


def download_firmware(log_queue, mode, hardware_version):
    """Download firmware for the specified hardware version and mode."""
    log_queue.put(f"Downloading {mode} firmware for HW {hardware_version}...")
    api_path = 'builds' if mode == 'production' else 'testing-builds'
    fw_dir = FIRMWARE_DIR if mode == 'production' else TESTING_FIRMWARE_DIR
    url = f"{DINOCORE_BASE_URL}/api/{api_path}"
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        builds = response.json()
        compatible = [b for b in builds if hardware_version in b.get('supported_versions', [])]
        if not compatible:
            log_queue.put(f"[X] No compatible {mode} firmware found for HW {hardware_version}.")
            return False
        latest_build = max(compatible, key=lambda x: x['created_at'])
        build_id = latest_build['id']
        log_queue.put(f"Found compatible build: {latest_build['name']}")
        os.makedirs(fw_dir, exist_ok=True)
        file_types = ['bootloader', 'app', 'partition_table', 'ota_initial']
        filenames = ["bootloader.bin", "magical-toys.bin", "partition-table.bin", "ota_data_initial.bin"]
        for f_type, f_name in zip(file_types, filenames):
            output_path = os.path.join(fw_dir, f_name)
            dl_url = f"{DINOCORE_BASE_URL}/api/{api_path}/{build_id}/files/{f_type}/download"
            log_queue.put(f"Downloading {f_name}...")
            dl_resp = requests.get(dl_url, stream=True, timeout=30)
            dl_resp.raise_for_status()
            with open(output_path, 'wb') as f:
                for chunk in dl_resp.iter_content(chunk_size=8192):
                    f.write(chunk)
        log_queue.put(f"[OK] {mode.capitalize()} firmware for {hardware_version} downloaded successfully.")
        return True
    except requests.exceptions.RequestException as e:
        log_queue.put(f"[X] Network error while downloading: {e}")
        return False


def burn_efuse(log_queue, port, version):
    """Burn eFuse with the specified version."""
    log_queue.put(f"Attempting to burn eFuse with version {version}...")
    version_parts = parse_version(version)
    if not version_parts:
        log_queue.put(f"[X] Invalid version format: {version}")
        return False

    log_queue.put("Attempting to reset device into download mode...")
    try:
        reset_cmd = [sys.executable, "-m", "esptool", "--chip", "esp32s3", "-p", port, "--before=default_reset", "--after=hard_reset", "chip_id"]
        result = subprocess.run(reset_cmd, capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            log_queue.put("Device reset successful, proceeding with eFuse burning...")
        else:
            log_queue.put("Device reset failed, but continuing with eFuse burning...")
    except Exception as e:
        log_queue.put(f"Device reset error: {e}, but continuing...")

    major, minor, patch = version_parts
    temp_file = f"temp_efuse_{port}.bin"
    try:
        with open(temp_file, 'wb') as f:
            buffer = bytearray(32)
            buffer[0], buffer[1], buffer[2] = major, minor, patch
            f.write(buffer)
        efuse_cmd = [sys.executable, "-m", "espefuse", "--chip", "esp32s3", "-p", port, "--do-not-confirm", "burn_block_data", "BLOCK3", temp_file]
        result = subprocess.run(efuse_cmd, capture_output=True, text=True, check=False)
        if result.returncode != 0:
            log_queue.put("Could not burn eFuse. It might be already written.")
            if result.stderr:
                log_queue.put(f"eFuse burn error: {result.stderr}")
            return False
        log_queue.put("[OK] eFuse burned successfully.")
        return True
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)


def read_efuse_version(log_queue, port):
    """Read the eFuse version from the specified port."""
    log_queue.put(f"Attempting to read eFuse from {port}...")
    try:
        summary_cmd = [sys.executable, "-m", "espefuse", "--chip", "esp32s3", "-p", port, "summary"]
        result = subprocess.run(summary_cmd, capture_output=True, text=True, check=False, timeout=15)
        if result.returncode != 0:
            log_queue.put("[X] Failed to read eFuse. Maybe locked?")
            return None
        output = result.stdout
        match = re.search(r"BLOCK_USR_DATA \(BLOCK3\).*?=\s*([0-9a-f]{2})\s*([0-9a-f]{2})\s*([0-9a-f]{2})", output, re.DOTALL | re.IGNORECASE)
        if match:
            major, minor, patch = int(match.group(1), 16), int(match.group(2), 16), int(match.group(3), 16)
            if major == 0 and minor == 0 and patch == 0:
                log_queue.put("[!] eFuse block is empty (version 0.0.0). Treating as no version found.")
                return None
            version = f"{major}.{minor}.{patch}"
            log_queue.put(f"[OK] Found raw eFuse version: {version}")
            return version
        log_queue.put("[!] No version found on eFuse.")
        return None
    except Exception as e:
        log_queue.put(f"[X] Error reading eFuse: {e}")
        return None


def flash_device(log_queue, port, mode, hardware_version):
    """Flash the device with the specified firmware."""
    log_queue.put(('show_progress',))
    from ..utils.config import START_FREQ, START_DUR, ERROR_FREQ, ERROR_DUR  # Avoid circular import
    from ..utils.helpers import play_sound
    
    play_sound(START_FREQ, START_DUR)
    log_queue.put(f"-- Starting {mode} flash for HW {hardware_version} on {port} --")
    fw_dir = FIRMWARE_DIR if mode == 'production' else TESTING_FIRMWARE_DIR
    if os.path.exists(fw_dir):
        for f in os.listdir(fw_dir):
            try:
                os.remove(os.path.join(fw_dir, f))
            except OSError:
                pass
    if not download_firmware(log_queue, mode, hardware_version):
        log_queue.put(f"[X] Download for {hardware_version} failed. Aborting flash.")
        play_sound(ERROR_FREQ, ERROR_DUR)
        log_queue.put(('hide_progress',))
        return False
    bootloader, app, p_table, ota_data = [os.path.join(fw_dir, f) for f in ["bootloader.bin", "magical-toys.bin", "partition-table.bin", "ota_data_initial.bin"]]
    from ..utils.config import FLASH_BAUD  # Import here to ensure available
    flash_cmd = [sys.executable, "-m", "esptool", "--chip", "esp32s3", "-p", port, "-b", FLASH_BAUD, "--before=default_reset", "--after=hard_reset", "write_flash", "--flash_mode", "dio", "--flash_freq", "80m", "--flash_size", "16MB", "0x0", bootloader, "0x260000", app, "0x10000", p_table, "0x15000", ota_data]
    try:
        process = subprocess.Popen(flash_cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, bufsize=1)
        is_flashing_main_app = False
        last_progress_line = ""
        for line in iter(process.stdout.readline, ''):
            if "Writing at" in line and "%" in line:
                # Clean up progress line
                progress_match = re.search(r'(\d+\.\d+)%', line)
                if progress_match:
                    clean_line = f"Flashing... {progress_match.group(0)}"  # Removed \r for log display
                    if clean_line != last_progress_line:
                        log_queue.put(('progress_update', clean_line))
                        last_progress_line = clean_line
            else:
                log_queue.put(line)

            if "Writing at 0x00260000" in line:
                is_flashing_main_app = True
            if is_flashing_main_app:
                match = re.search(r"([\d\.]+)\%", line)
                if match:
                    progress = int(float(match.group(1)))
                    log_queue.put(('progress', progress))
            if is_flashing_main_app and "Wrote" in line and "at 0x00260000" in line:
                is_flashing_main_app = False
        process.stdout.close()
        return_code = process.wait()
        if return_code != 0:
            log_queue.put(f"\n[X] Flash failed with exit code {return_code}.\n")
            play_sound(ERROR_FREQ, ERROR_DUR)
            return False
        else:
            log_queue.put("\n[OK] Flash successful!\n")
            from ..utils.config import END_FREQ, END_DUR  # Avoid circular import
            play_sound(END_FREQ, END_DUR)
            return True
    except Exception as e:
        log_queue.put(f"\n[X] An unexpected error occurred during flash: {e}\n")
        play_sound(ERROR_FREQ, ERROR_DUR)
        return False
    finally:
        log_queue.put(('hide_progress',))
        log_queue.put(f"-- Finished flashing {port} --")