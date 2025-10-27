#!/usr/bin/env python3
"""
DinoCore Production Flasher - Bluetooth QC Testing Module
Offline quality control testing via Bluetooth LE
"""

import os
import sys
import time
import threading
import json
import queue
from typing import Optional, Dict, Any, Callable

# Check if bleak (Bluetooth library) is available
try:
    import bleak
    BLEAK_AVAILABLE = True
except ImportError:
    BLEAK_AVAILABLE = False
    bleak = None

from i18n_utils import _

class BluetoothQCTester:
    """Bluetooth-based Quality Control Tester for DinoCore devices"""

    def __init__(self):
        self.device = None
        self.client = None
        self.log_queue = None
        self.test_results = []
        self.is_connected = False
        self.is_testing = False
        self.current_test = None

        # Bluetooth service and characteristic UUIDs
        self.QA_SERVICE_UUID = 'a07498ca-ad5b-474e-940d-16f1fbe7e8cd'
        self.QA_CONTROL_UUID = 'b30ac6b4-1b2d-4c2f-9c10-4b2a7b80f1a1'
        self.QA_EVENTS_UUID = 'f29f4a3e-9a53-4d93-9b33-0a1cc4f0c8a2'

        # QC thresholds
        self.QC_THRESHOLD = 4500

        # Test definitions
        self.tests = [
            {
                'name': _("Test Mic L/R Balance"),
                'command': 'qa_mic_lr_test',
                'payload': {
                    'wait_ms': 2000,
                    'tone_ms': 2000,
                    'volume_percent': 95,
                    'freq_hz': 1000
                },
                'timeout': 10000,
                'description': _("Test microphone left/right balance")
            }
        ]

    def set_log_queue(self, queue_ref):
        """Set the logging queue for UI updates"""
        self.log_queue = queue_ref

    def log(self, level: str, message: str, data=None):
        """Add message to log queue"""
        if self.log_queue:
            self.log_queue.put({
                'level': level,
                'message': message,
                'data': data,
                'timestamp': time.time()
            })

    async def scan_devices(self) -> list:
        """Scan for available Bluetooth devices"""
        if not BLEAK_AVAILABLE:
            self.log('error', _("Bluetooth library not available"))
            return []

        try:
            self.log('info', _("Scanning for Bluetooth devices..."))

            devices = await bleak.BleakScanner.discover(timeout=5.0)

            # Filter devices - less strict to detect more devices
            qa_devices = []
            for device in devices:
                # Accept any device with a name (not None or empty)
                if device.name and device.name.strip():
                    # Include devices that might be DinoCore devices or any Bluetooth device for testing
                    if ('dino' in device.name.lower() or
                        'qa' in device.name.lower() or
                        'esp' in device.name.lower() or
                        'bt' in device.name.lower() or
                        len(device.name) > 3):  # Accept devices with names longer than 3 chars
                        qa_devices.append(device)

            # If no devices match the filter, include all devices as fallback
            if not qa_devices and devices:
                self.log('info', _("No devices matched filter, using all available devices"))
                qa_devices = devices

            self.log('info', _("Found {} potential QA devices").format(len(qa_devices)))
            return qa_devices

        except Exception as e:
            self.log('error', _("Error scanning Bluetooth devices: {}").format(str(e)))
            return []

    async def connect_device(self, device_address: str) -> bool:
        """Connect to Bluetooth device"""
        if not BLEAK_AVAILABLE:
            self.log('error', _("Bluetooth library not available"))
            return False

        try:
            self.log('info', _("Connecting to device: {}").format(device_address))

            self.client = bleak.BleakClient(device_address)
            await self.client.connect()

            if self.client.is_connected:
                self.is_connected = True
                self.log('success', _("Connected to device"))

                # Start notification handler
                await self.start_notifications()

                return True
            else:
                self.log('error', _("Failed to connect to device"))
                return False

        except Exception as e:
            self.log('error', _("Connection error: {}").format(str(e)))
            return False

    async def start_notifications(self):
        """Start listening for notifications from device"""
        try:
            await self.client.start_notify(self.QA_EVENTS_UUID, self.notification_handler)
            self.log('success', _("Bluetooth notifications started"))
        except Exception as e:
            self.log('error', _("Failed to start notifications: {}").format(str(e)))

    def notification_handler(self, sender, data):
        """Handle incoming Bluetooth notifications"""
        try:
            # Decode JSON data
            message = data.decode('utf-8', errors='ignore')
            self.log('info', f"[BLE RX] {message}")

            try:
                json_data = json.loads(message)

                # Handle different message types
                if json_data.get('kind') == 'mic_lr_test':
                    self.handle_mic_lr_test_result(json_data)
                elif json_data.get('type') == 'qa_instruction':
                    self.handle_instruction(json_data)
                else:
                    self.log('info', _("Unhandled message type: {}").format(json_data.get('type', 'unknown')))

            except json.JSONDecodeError:
                # Handle plain text messages
                self.handle_text_message(message)

        except Exception as e:
            self.log('error', _("Error processing Bluetooth message: {}").format(str(e)))

    def handle_mic_lr_test_result(self, data: Dict[str, Any]):
        """Handle microphone L/R balance test results"""
        try:
            payload = data.get('payload', {})

            if payload.get('tone'):
                rms_l = payload['tone'].get('rms_L', 0)
                rms_r = payload['tone'].get('rms_R', 0)

                # Apply QC threshold
                left_passed = rms_l > self.QC_THRESHOLD
                right_passed = rms_r > self.QC_THRESHOLD
                overall_passed = left_passed and right_passed

                self.log('success', _("Processing microphone test results"))
                self.log('info', _("Left channel: {:.1f} RMS ({})").format(
                    rms_l, _("PASS") if left_passed else _("FAIL")))
                self.log('info', _("Right channel: {:.1f} RMS ({})").format(
                    rms_r, _("PASS") if right_passed else _("FAIL")))

                # Create test result
                result = {
                    'name': _("Test Mic L/R Balance"),
                    'status': 'pass' if overall_passed else 'fail',
                    'details': _("L: {:.1f} RMS, R: {:.1f} RMS [Threshold: >{}]").format(
                        rms_l, rms_r, self.QC_THRESHOLD),
                    'evaluation_data': {
                        'rms_L': rms_l,
                        'rms_R': rms_r,
                        'left_passed': left_passed,
                        'right_passed': right_passed,
                        'threshold': self.QC_THRESHOLD
                    },
                    'raw_response': data,
                    'timestamp': time.time()
                }

                self.test_results.append(result)
                self.log('success' if overall_passed else 'error',
                        _("Test completed: {}").format(_("PASS") if overall_passed else _("FAIL")))

                # Continue to next test or complete
                self.current_test = None

        except Exception as e:
            self.log('error', _("Error processing mic test: {}").format(str(e)))

    def handle_instruction(self, data: Dict[str, Any]):
        """Handle instruction messages from device"""
        instruction = data.get('instruction', '')
        if data.get('wait_for_user', False):
            self.log('warning', _("User action required: {}").format(instruction))
            # Could trigger UI callback here for user interaction
        else:
            self.log('info', _("Instruction: {}").format(instruction))

    def handle_text_message(self, message: str):
        """Handle plain text messages (legacy compatibility)"""
        if 'PASS' in message or 'FAIL' in message:
            status = 'pass' if 'PASS' in message else 'fail'
            if self.current_test:
                result = {
                    'name': self.current_test['name'],
                    'status': status,
                    'details': message,
                    'timestamp': time.time()
                }
                self.test_results.append(result)
                self.log('success' if status == 'pass' else 'error',
                        _("Received test result: {}").format(status.upper()))
                self.current_test = None

    async def send_command(self, command: str, payload: Optional[Dict] = None) -> bool:
        """Send command to Bluetooth device"""
        if not self.client or not self.is_connected:
            self.log('error', _("Not connected to device"))
            return False

        try:
            # Construct the JSON string manually to avoid any potential issues with json.dumps
            command_id = f"{command}_{int(time.time())}"
            payload_str = json.dumps(payload or {})
            
            json_command = f'{{"id":"{command_id}","type":"{command}","payload":{payload_str}}}'
            command_bytes = json_command.encode('utf-8')

            self.log('info', f"[BLE TX] {json_command}")
            await self.client.write_gatt_char(self.QA_CONTROL_UUID, command_bytes)

            return True

        except Exception as e:
            self.log('error', _("Failed to send command: {}").format(str(e)))
            return False

    async def run_test(self, test_index: int) -> bool:
        """Run a specific QC test"""
        if not self.is_connected:
            self.log('error', _("Not connected - cannot run tests"))
            return False

        if test_index >= len(self.tests):
            self.log('error', _("Invalid test index: {}").format(test_index))
            return False

        test = self.tests[test_index]
        self.current_test = test

        self.log('info', _("Starting test: {}").format(test['name']))

        # Send command
        success = await self.send_command(test['command'], test['payload'])

        if success:
            # Set timeout for test
            self.test_timeout = time.time() + (test['timeout'] / 1000)
            return True
        else:
            self.current_test = None
            return False

    def get_test_results(self) -> list:
        """Get all test results"""
        return self.test_results.copy()

    def clear_results(self):
        """Clear test results"""
        self.test_results.clear()

    async def disconnect(self):
        """Disconnect from Bluetooth device"""
        if self.client and self.is_connected:
            try:
                await self.client.disconnect()
                self.log('info', _("Disconnected from Bluetooth device"))
            except Exception as e:
                self.log('error', _("Error disconnecting: {}").format(str(e)))

        self.is_connected = False
        self.client = None

    def check_bluetooth_availability(self) -> bool:
        """Check if Bluetooth is available on this system"""
        if not BLEAK_AVAILABLE:
            self.log('warning', _("Bluetooth library (bleak) not installed"))
            return False

        try:
            import platform
            system = platform.system().lower()

            if system == 'windows':
                # Check if Bluetooth is available on Windows
                return True  # Assume available, will fail during connection if not
            elif system == 'linux':
                # Check for bluetoothctl or other indicators
                return True
            elif system == 'darwin':  # macOS
                return True

        except Exception:
            pass

        return False

# Global instance for easier access
bt_qc_tester = BluetoothQCTester()

def get_bluetooth_qc_tester():
    """Get the global Bluetooth QC tester instance"""
    return bt_qc_tester

def install_bluetooth_dependencies():
    """Check and install Bluetooth dependencies"""
    global BLEAK_AVAILABLE
    if not BLEAK_AVAILABLE:
        print(_("Installing Bluetooth dependencies..."))
        try:
            import subprocess
            result = subprocess.run([
                sys.executable, '-m', 'pip', 'install', 'bleak'
            ], capture_output=True, text=True)

            if result.returncode == 0:
                print(_("Bluetooth dependencies installed successfully"))
                # Try to import again
                try:
                    import bleak
                    BLEAK_AVAILABLE = True
                    print(_("Bluetooth now available"))
                except ImportError:
                    print(_("Bluetooth installation incomplete - restart required"))
            else:
                print(_("Failed to install Bluetooth dependencies"))
        except Exception as e:
            print(_("Error installing Bluetooth: {}").format(str(e)))

if __name__ == "__main__":
    # Check dependencies when run directly
    if not BLEAK_AVAILABLE:
        install_bluetooth_dependencies()
    else:
        print(_("Bluetooth QC tester ready - use bleak library available"))
