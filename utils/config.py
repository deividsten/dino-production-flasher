"""Configuration constants for the DinoCore Production Flasher."""

import os

# --- Configuration ---
DINOCORE_BASE_URL = "https://dinocore-telemetry-production.up.railway.app/"
FIRMWARE_DIR = "production_firmware"
TESTING_FIRMWARE_DIR = "testing_firmware"
FLASH_BAUD = "460800"
MONITOR_BAUD = "115200"
CONFIG_FILE = "config.ini"

# --- Sound Definitions ---
START_FREQ = 800
START_DUR = 150
END_FREQ = 1200
END_DUR = 400
ERROR_FREQ = 400
ERROR_DUR = 800

# --- File Paths ---
LOG_FILE = "session.log"