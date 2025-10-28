"""Main GUI application for the DinoCore Production Flasher."""

import os
import sys
import time
import subprocess
import requests
import winsound
import threading
import queue
import logging
import tkinter as tk
from tkinter import scrolledtext, messagebox, ttk
from serial.tools.list_ports import comports
import re
import traceback
import serial
import configparser
from tkinter import simpledialog
import asyncio
from typing import Optional
from PIL import Image, ImageTk, ImageDraw, ImageFont

# Import internationalization system
from ..i18n_utils import _, translation_manager

# Import local modules
try:
    from ..business_logic.bluetooth_qc import get_bluetooth_qc_tester, BLEAK_AVAILABLE
    BT_QC_AVAILABLE = True
except ImportError:
    BT_QC_AVAILABLE = False
    get_bluetooth_qc_tester = None

try:
    from ..updater import DinoUpdater
except ImportError:
    DinoUpdater = None

# Firebase database integration (optional)
try:
    from firebase_db import get_firebase_db, store_qc_results, store_flash_log, store_session_log, store_device_session, init_firebase_with_credentials
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    get_firebase_db = None

# API client integration (optional)
try:
    from ..api_client import get_inventory_api, update_toy_inventory, send_to_bondu
    API_AVAILABLE = True
except ImportError:
    API_AVAILABLE = False
    get_inventory_api = None

# Import business logic
from ..business_logic.device_detection import get_esp32_port, serial_monitor_thread, process_device_thread
from ..business_logic.bluetooth_qc import BluetoothQCManager
from ..utils import config as app_config
from ..utils.config import (
    DINOCORE_BASE_URL, FIRMWARE_DIR, TESTING_FIRMWARE_DIR, FLASH_BAUD, 
    MONITOR_BAUD, CONFIG_FILE, START_FREQ, START_DUR, END_FREQ, END_DUR, 
    ERROR_FREQ, ERROR_DUR, LOG_FILE
)
from ..utils.helpers import play_sound, create_icon_from_emoji, parse_version
from .log_viewer import LogViewer
from .dialogs import VersionDialog


class FlasherApp:
    def __init__(self, root):
        self.root = root
        self.root.title(_("DinoCore Production Flasher v1.2.0"))
        self.root.geometry(f"{self.root.winfo_screenwidth()}x{self.root.winfo_screenheight()}+0+0")
        self.root.state('zoomed')  # Use zoomed instead of fullscreen to keep window borders
        self.root.resizable(True, True)

        # --- Set App Icon ---
        try:
            # Create a simple image with the emoji for the icon
            # This is a cross-platform way to set an icon without needing an .ico file
            from PIL import Image, ImageDraw, ImageFont
            
            # Create a blank image with transparency
            icon_image = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
            draw = ImageDraw.Draw(icon_image)
            
            # Try to load a suitable font
            try:
                font = ImageFont.truetype("seguiemj.ttf", 48)
            except IOError:
                font = ImageFont.load_default()

            # Draw the emoji centered on the image
            draw.text((32, 32), "🦖", font=font, anchor="mm", fill="#89dceb")
            
            self.app_icon = ImageTk.PhotoImage(icon_image)
            self.root.iconphoto(True, self.app_icon)
        except Exception as e:
            print(f"Could not set app icon: {e}") # Non-critical error

        # Ultra-Modern Dark Theme
        self.colors = {
            'bg': '#1e1e2e',           # Deep dark blue-grey
            'log_bg': '#2a2a3a',       # Slightly lighter dark
            'text': '#cdd6f4',         # Light blue-grey text
            'log_text': '#89b4fa',     # Light blue
            'header_bg': '#181825',    # Very dark header
            'prod_btn': '#f38ba8',     # Soft red
            'test_btn': '#89dceb',     # Soft blue
            'stop_btn': '#a6e3a1',     # Soft green
            'success_btn': '#a6e3a1',  # Emerald
            'warning_btn': '#f9e2af',  # Yellow
            'status_prod': '#f38ba8',  # Red for active
            'status_test': '#89dceb',  # Blue for active
            'status_idle': '#6c7086',  # Grey for idle
            'status_success': '#a6e3a1', # Green for success
            'status_warning': '#fab387',  # Orange warning
            'frame_bg': '#313244',     # Medium grey-blue
            'entry_bg': '#1e1e2e',     # Same as bg
            'entry_fg': '#cdd6f4',     # Light text
            'border': '#f38ba8',       # Red accent
            'highlight': '#89b4fa',    # Blue accent
            'info': '#89b4fa'          # Blue for info elements
        }

        self.root.configure(bg=self.colors['bg'])
        self.root.attributes('-topmost', True)  # Always on top for better UX
        self.root.after(100, lambda: self.root.attributes('-topmost', False))
        
        # --- File Logger Setup ---
        self.log_file = app_config.LOG_FILE
        # Clear log file on start, ensuring it's UTF-8
        with open(self.log_file, "w", encoding="utf-8") as f:
            f.write(f"--- Session Log Started: {time.strftime('%Y-%m-%d %H:%M:%S')} ---\n\n")
        
        self.hw_version_var = tk.StringVar()
        self.toy_id_var = tk.StringVar()
        self.captured_ble_name = None
        self.physical_id = None
        self.session_logs = []
        self.ble_ready_event = threading.Event()
        self.workflow_step = 0  # 0: toy_id, 1: dino_connection, 2: ready
        self.api_payload_sent = False  # Track if the API payload has been sent for this device
        
        self.log_queue = queue.Queue()
        self.scanner_stop_event = threading.Event()
        
        # Initialize Bluetooth QC Manager
        self.bluetooth_qc_manager = BluetoothQCManager(self.log_queue, self, get_bluetooth_qc_tester if get_bluetooth_qc_tester else None, BLEAK_AVAILABLE)
        
        # --- Create Icons ---
        self.icons = {
            'success': create_icon_from_emoji("✅", self.colors['success_btn']),
            'error': create_icon_from_emoji("❌", self.colors['prod_btn']),
            'warning': create_icon_from_emoji("⚠️", self.colors['warning_btn']),
            'info': create_icon_from_emoji("ℹ️", self.colors['log_text']),
            'bt': create_icon_from_emoji("🔵", self.colors['highlight']),
            'firebase': create_icon_from_emoji("🔥", "#f5a97f"),
            'flash': create_icon_from_emoji("⚡", "#f9e2af"),
            'en_flag': create_icon_from_emoji("🇺🇸", "#000000"), # Color doesn't matter for flag
            'zh_flag': create_icon_from_emoji("🇨🇳", "#000000"),
        }

        self.create_widgets()
        self.update_log()

        # Initialize Firebase and logging
        if FIREBASE_AVAILABLE:
            init_thread = threading.Thread(target=self.initialize_firebase, daemon=True)
            init_thread.start()

        # Start comprehensive logging immediately
        self.start_comprehensive_logging()

        # Hide all UI elements initially and only show toy ID input
        self.hide_all_ui_elements()
        # Start the workflow immediately after UI is ready
        self.root.after(200, self.start_qr_workflow)

    def show_test_results_section(self):
        """Show the test results section after testing flash completes"""
        self.results_frame.pack(fill=tk.X, pady=(0, 10))

    def set_captured_ble_details(self, mac, name):
        self.physical_id = mac
        self.captured_ble_name = name
        self.ble_ready_event.set() # Signal that BLE is ready
        self.bt_qc_button.config(state='normal')
        self.status_label.config(text="🔵 " + _("Ready for Bluetooth QC"), bg=self.colors['highlight'])

        # Show test results section now that testing flash is complete
        self.show_test_results_section()

        # Auto-start Bluetooth QC immediately when BLE details are captured
        self.log_queue.put("🚀 BLE details captured. Auto-starting Bluetooth QC...")
        self.root.after(100, self.start_bluetooth_qc)  # Small delay to ensure UI updates

    def start_qr_workflow(self):
        """Start the QR scanner optimized workflow automatically"""
        self.log_queue.put("🚀 Starting QR Scanner Workflow - Field ready for scanning!")
        self.log_queue.put("📱 Position QR scanner and scan toy code...")
        self.ask_toy_id()

    def ask_toy_id(self):
        """Ask for toy ID in the main window (no popup)"""
        self.show_toy_id_input()

    def show_toy_id_input(self):
        """Show toy ID input section in main window"""
        # Hide existing content and show toy ID input
        self.status_label.config(text=_("🆔 Enter Toy ID"), bg=self.colors['status_idle'])

        # Create toy ID input frame (above test results)
        self.toy_id_frame = tk.Frame(self.control_area, bg=self.colors['frame_bg'], relief=tk.GROOVE, borderwidth=2)
        self.toy_id_frame.pack(fill=tk.X, pady=(10, 0))

        toy_id_inner = tk.Frame(self.toy_id_frame, bg=self.colors['frame_bg'])
        toy_id_inner.pack(fill=tk.X, padx=15, pady=15)

        # Simple text instruction for toy ID scanning
        tk.Label(toy_id_inner, text=_("Scan Toy ID"), font=("Segoe UI", 12, "bold"),
                bg=self.colors['frame_bg'], fg=self.colors['info']).pack(side=tk.LEFT, padx=(15, 0))

        self.toy_id_entry = tk.Entry(toy_id_inner, textvariable=self.toy_id_var,
                                    font=("Consolas", 16), width=28, bg=self.colors['entry_bg'],
                                    fg=self.colors['entry_fg'], insertbackground=self.colors['text'],
                                    relief=tk.FLAT, borderwidth=2)
        self.toy_id_entry.pack(side=tk.LEFT, padx=(0, 15))
        self.toy_id_entry.focus_set()

        self.toy_id_ok_button = tk.Button(toy_id_inner, text=_("OK"), font=("Segoe UI", 14, "bold"),
                                         bg=self.colors['success_btn'], fg=self.colors['bg'],
                                         command=self.on_toy_id_ok, relief=tk.FLAT, padx=25, pady=8)
        self.toy_id_ok_button.pack(side=tk.RIGHT)

        self.toy_id_entry.bind("<Return>", self.on_toy_id_ok)

    def process_toy_id_input(self, raw_input):
        """
        Process toy ID input, handling both direct IDs and Bondu.com URLs.

        Examples:
        - Direct ID: "DINO-001" -> "DINO-001"
        - Bondu URL: "https://bondu.com/toy/2drvff" -> "toy_2drvff"
        """
        raw_input = raw_input.strip()

        # Check if it's a Bondu.com URL
        if raw_input.startswith(('https://bondu.com/toy/', 'http://bondu.com/toy/', 'bondu.com/toy/')):
            # Extract the ID from the URL path
            if 'bondu.com/toy/' in raw_input:
                # Handle both full URLs and domain-less paths
                # Extract everything after 'bondu.com/toy/' and take the first path segment before any '?' or '#'
                try:
                    # Split by 'bondu.com/toy/' and get the part after it
                    after_domain = raw_input.split('bondu.com/toy/', 1)[-1]
                    # Split by '/' to get the first path segment
                    path_segment = after_domain.split('/')[0]
                    # Remove any query parameters or fragments
                    path_segment = path_segment.split('?')[0].split('#')[0]
                    # Remove any trailing slashes or other characters
                    path_segment = path_segment.rstrip('/')
                    
                    if path_segment:
                        processed_id = f"toy_{path_segment}"
                        self.log_queue.put(f"🔧 Toy ID parsed from Bondu URL: '{raw_input}' -> '{processed_id}'")
                        return processed_id, raw_input  # Return both processed ID and original URL
                    else:
                        # Fallback to using raw input if parsing fails
                        self.log_queue.put(f"⚠️ Failed to parse toy ID from Bondu URL: '{raw_input}' - using raw input")
                        return raw_input, raw_input
                except Exception as e:
                    # Fallback to using raw input if parsing fails
                    self.log_queue.put(f"⚠️ Error parsing toy ID from Bondu URL: '{raw_input}' - {e} - using raw input")
                    return raw_input, raw_input

        # If not a URL, return as-is
        return raw_input, raw_input

    def on_toy_id_ok(self, event=None):
        """Handle toy ID OK button"""
        raw_input = self.toy_id_var.get().strip()

        if not raw_input:
            messagebox.showerror(_("Error"), _("Toy ID cannot be empty"))
            return

        # Process the input (handle URLs or direct IDs)
        processed_toy_id, original_input = self.process_toy_id_input(raw_input)

        # Validate processed toy ID format
        if not re.match(r'^[A-Za-z0-9_-]+$', processed_toy_id):
            messagebox.showerror(_("Error"), _("Toy ID can only contain letters, numbers, hyphens, and underscores"))
            return

        if len(processed_toy_id) < 3 or len(processed_toy_id) > 50:
            messagebox.showerror(_("Error"), _("Toy ID must be between 3 and 50 characters long"))
            return

        # Store both the processed ID and original input
        self.processed_toy_id = processed_toy_id
        self.original_toy_input = original_input

        self.log_queue.put(f"📋 Input received: {original_input}")
        self.log_queue.put(f"🆔 Processed Toy ID: {processed_toy_id}")

        # Hide toy ID input and show connection instructions
        self.hide_toy_id_input()
        self.ask_dino_connection()

    def on_toy_id_cancel(self):
        """Handle toy ID cancel button"""
        if messagebox.askokcancel("Quit", "Do you want to exit the application?"):
            self.root.destroy()

    def hide_toy_id_input(self):
        """Hide the toy ID input frame"""
        if hasattr(self, 'toy_id_frame'):
            self.toy_id_frame.pack_forget()

    def ask_dino_connection(self):
        """Show dino connection instructions in main window"""
        self.show_dino_connection_instructions()

    def show_dino_connection_instructions(self):
        """Show dino connection instructions in main window"""
        self.status_label.config(text=_("🔗 Connect Dino Device"), bg=self.colors['status_idle'])

        # Create connection instructions frame
        self.connection_frame = tk.Frame(self.control_area, bg=self.colors['frame_bg'], relief=tk.GROOVE, borderwidth=2)
        self.connection_frame.pack(fill=tk.X, pady=(10, 0))

        connection_inner = tk.Frame(self.connection_frame, bg=self.colors['frame_bg'])
        connection_inner.pack(fill=tk.X, padx=15, pady=15)

        # Visual T-Rex pointing to box instruction
        visual_frame = tk.Frame(connection_inner, bg=self.colors['frame_bg'])
        visual_frame.pack(anchor="w", pady=(0, 10))

        # T-Rex in green
        tk.Label(visual_frame, text="🦖", font=("Segoe UI Emoji", 24),
                bg=self.colors['frame_bg'], fg="#89dceb").pack(side=tk.LEFT)

        # Arrow in blue
        tk.Label(visual_frame, text="→", font=("Segoe UI", 20, "bold"),
                bg=self.colors['frame_bg'], fg="#89b4fa").pack(side=tk.LEFT, padx=(5, 5))

        # Box in orange
        tk.Label(visual_frame, text="📦", font=("Segoe UI Emoji", 24),
                bg=self.colors['frame_bg'], fg="#f9e2af").pack(side=tk.LEFT)

        # Create individual translated instruction lines
        instructions = [
            _("1. Connect the Dino device to the computer via USB"),
            _("2. Place the Dino inside the testing box"),
            _("3. Make sure the device is powered on"),
            _("4. Wait for the device to be detected")
        ]

        instructions_text = "\n".join(instructions)

        self.instructions_label = tk.Label(connection_inner, text=instructions_text, font=("Segoe UI", 24, "bold"),
                bg=self.colors['frame_bg'], fg=self.colors['text'], justify="left")
        self.instructions_label.pack(anchor="w", pady=(10, 15))

        # Status
        self.connection_status_label = tk.Label(connection_inner, text="⏳ Waiting for device...",
                                               font=("Segoe UI", 18, "bold"), bg=self.colors['frame_bg'],
                                               fg=self.colors['log_text'])
        self.connection_status_label.pack(anchor="w", pady=(0, 10))

        # Button frame
        button_frame = tk.Frame(connection_inner, bg=self.colors['frame_bg'])
        button_frame.pack(fill=tk.X)

        self.connection_ok_button = tk.Button(button_frame, text=_("✅ Device Ready"), font=("Segoe UI", 24, "bold"),
                                             bg=self.colors['success_btn'], fg=self.colors['bg'],
                                             command=self.on_connection_ok, relief=tk.FLAT, padx=40, pady=15)
        self.connection_ok_button.pack(side=tk.RIGHT)

        # Start device detection
        self.start_device_detection()

    def start_device_detection(self):
        """Start monitoring for device connection"""
        self.scanner_stop_event.clear()
        detector_thread = threading.Thread(target=self.device_detector_worker, daemon=True)
        detector_thread.start()

    def on_connection_ok(self):
        """Handle connection OK button"""
        if not self.esp32_port:
            messagebox.showerror("Error", "No ESP32 device detected. Please make sure the device is connected and powered on.")
            return

        self.log_queue.put(f"✅ Device ready on port: {self.esp32_port}")

        # Hide connection instructions and proceed with normal flow
        self.hide_connection_instructions()
        self.reset_progress_bar()  # Reset progress bar to 0%
        self.set_default_hardware_version()

        # Auto-start Testing & eFuse flash after device is ready
        self.root.after(500, self.auto_start_testing_flash)  # Small delay to let UI update

    def on_connection_cancel(self):
        """Handle connection cancel button"""
        if messagebox.askokcancel("Quit", "Do you want to exit the application?"):
            self.root.destroy()

    def hide_connection_instructions(self):
        """Hide the connection instructions frame"""
        if hasattr(self, 'connection_frame'):
            self.connection_frame.pack_forget()
        self.scanner_stop_event.set()  # Stop device detection

    def set_default_hardware_version(self):
        """Set default hardware version and show main interface"""
        default_version = "1.9.1"
        self.hw_version_var.set(default_version)
        self.log_queue.put(f"🎯 Using default hardware version: {default_version}")

        # Show all UI elements now that we have completed the workflow
        self.show_all_ui_elements()

        # Start device detection
        self.scanner_stop_event.clear()
        detector_thread = threading.Thread(target=self.device_detector_worker, daemon=True)
        detector_thread.start()

    def show_all_ui_elements(self):
        """Show all the main UI elements after workflow completion"""
        # In workflow mode, don't show manual sections
        if not self.manual_mode:
            # Show main frames (but not manual sections)
            pass  # No notebook to show anymore
        else:
            # Show manual sections when in manual mode
            self.config_frame.pack(fill=tk.X, pady=(0, 15))
            self.flash_frame.pack(fill=tk.X, pady=(10, 5))
            self.qc_frame.pack(fill=tk.X, pady=(5, 0))

            # Show buttons (they need to be packed in their parent containers)
            self.prod_button.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
            self.test_button.pack(side=tk.RIGHT, fill=tk.X, expand=True, padx=(5, 0))
            self.bt_select_button.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
            self.bt_qc_button.pack(side=tk.RIGHT, fill=tk.X, expand=True, padx=(5, 0))

        # Update status to ready state
        self.status_label.config(text="🔌 " + _("Connect ESP32 Device"), bg=self.colors['status_idle'])

    def toggle_manual_mode(self):
        """Toggle between workflow mode and manual mode"""
        self.manual_mode = not self.manual_mode

        if self.manual_mode:
            # Switch to manual mode
            self.manual_mode_button.config(text="🔄 Workflow Mode", bg=self.colors['success_btn'])
            self.log_queue.put("🔧 Switched to Manual Mode - showing all controls")

            # Show manual sections
            self.config_frame.pack(fill=tk.X, pady=(0, 15), before=self.results_frame)
            self.flash_frame.pack(fill=tk.X, pady=(10, 5), before=self.manual_mode_button)
            self.qc_frame.pack(fill=tk.X, pady=(5, 0), before=self.manual_mode_button)

            # Show buttons
            self.prod_button.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
            self.test_button.pack(side=tk.RIGHT, fill=tk.X, expand=True, padx=(5, 0))
            self.bt_select_button.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
            self.bt_qc_button.pack(side=tk.RIGHT, fill=tk.X, expand=True, padx=(5, 0))

        else:
            # Switch to workflow mode
            self.manual_mode_button.config(text="🔧 Manual Mode", bg=self.colors['warning_btn'])
            self.log_queue.put("🔄 Switched to Workflow Mode - hiding manual controls")

            # Hide manual sections
            self.config_frame.pack_forget()
            self.flash_frame.pack_forget()
            self.qc_frame.pack_forget()

            # Hide buttons
            self.prod_button.pack_forget()
            self.test_button.pack_forget()
            self.bt_select_button.pack_forget()
            self.bt_qc_button.pack_forget()

    def auto_start_testing_flash(self):
        """Automatically start the Testing & eFuse flash after device is ready"""
        if self.test_button.winfo_exists() and self.test_button.cget('state') == 'normal':
            self.log_queue.put("🚀 Auto-starting Testing & eFuse flash...")
            # Start flash progress animation immediately
            self.start_flash_progress_animation()
            self.start_flashing('testing')
        else:
            self.log_queue.put("⚠️ Testing & eFuse button not ready yet")

    def auto_start_bluetooth_qc_after_flash(self):
        """Automatically start Bluetooth QC 8 seconds after flash completes"""
        if hasattr(self, 'bt_qc_button') and self.bt_qc_button.winfo_exists():
            if self.bt_qc_button.cget('state') == 'normal':
                self.log_queue.put("⏳ Waiting 8 seconds before starting Bluetooth QC...")
                self.root.after(8000, self.auto_trigger_bluetooth_qc)  # 8 second delay
            else:
                self.log_queue.put("⚠️ Bluetooth QC button not ready yet")
        else:
            self.log_queue.put("⚠️ Bluetooth QC button not found")

    def auto_trigger_bluetooth_qc(self):
        """Automatically trigger the Bluetooth QC button"""
        if hasattr(self, 'bt_qc_button') and self.bt_qc_button.winfo_exists():
            if self.bt_qc_button.cget('state') == 'normal':
                self.log_queue.put("🚀 Auto-starting Bluetooth QC after 8 second delay...")
                self.bt_qc_button.invoke()  # Trigger the button click
            else:
                self.log_queue.put("⚠️ Bluetooth QC button not available for auto-start")
        else:
            self.log_queue.put("⚠️ Bluetooth QC button not found for auto-trigger")

    def send_toy_data_to_firebase(self, toy_id, mac_address, test_data):
        """
        Send the EXACT SAME payload to Firebase as sent to the API
        """
        try:
            # Import the firebase function if available
            if not FIREBASE_AVAILABLE:
                self.log_queue.put("⚠️ Firebase not available for backup sending")
                return False

            # Send the EXACT SAME payload format as used for the Bondu API
            exact_same_payload = {
                'toy_id': toy_id,
                'mac_address': mac_address,
                'test_data': test_data
            }

            # Use the payload directly (Firebase will store it as-is)
            if store_device_session(exact_same_payload):
                self.log_queue.put("🔥 Toy data successfully sent to Firebase as security backup")
                return True
            else:
                self.log_queue.put("⚠️ Failed to send toy data to Firebase backup")
                return False

        except Exception as e:
            self.log_queue.put(f"⚠️ Error sending toy data to Firebase backup: {e}")
            return False


    def initialize_firebase(self):
        self.log_queue.put(("Firebase", "Attempting to initialize Firebase..."))
        if init_firebase_with_credentials():
            self.log_queue.put(("Firebase", "✅ Firebase connection successful."))
        else:
            self.log_queue.put(("Firebase", "⚠️ Firebase connection failed. Logs will not be saved."))

    def start_comprehensive_logging(self):
        """Start comprehensive logging to Firebase for debugging."""
        try:
            # Send initial startup log
            self.log_queue.put(("Firebase", "🚀 Starting DinoCore Production Flasher v1.2.14"))
            self.log_queue.put(("Firebase", f"📍 Working directory: {os.getcwd()}"))
            self.log_queue.put(("Firebase", f"🐍 Python version: {sys.version}"))

            # Try to initialize Firebase if available (only if not already initialized)
            if FIREBASE_AVAILABLE:
                try:
                    # Check if already initialized by trying to get the global instance
                    firebase_instance = get_firebase_db()
                    if not firebase_instance.initialized:
                        if init_firebase_with_credentials():
                            self.log_queue.put(("Firebase", "✅ Firebase initialized successfully"))
                        else:
                            self.log_queue.put(("Firebase", "⚠️ Firebase initialization failed"))
                    else:
                        self.log_queue.put(("Firebase", "✅ Firebase already initialized"))
                except Exception as e:
                    self.log_queue.put(("Firebase", f"❌ Firebase error: {e}"))
            else:
                self.log_queue.put(("Firebase", "⚠️ Firebase not available"))

        except Exception as e:
            print(f"Error in comprehensive logging: {e}")

    def create_widgets(self):
        # Modern header with gradient and branding
        header_frame = tk.Frame(self.root, bg=self.colors['header_bg'], height=60)
        header_frame.pack(fill=tk.X, padx=0, pady=0)
        header_frame.pack_propagate(False)

        # Header content
        header_content = tk.Frame(header_frame, bg=self.colors['header_bg'])
        header_content.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)

        # Title with logo and text (removed duplicate title - already in window title)
        title_frame = tk.Frame(header_content, bg=self.colors['header_bg'])
        title_frame.pack(side=tk.LEFT)

        # Just show the logo and version, no duplicate title text
        tk.Label(title_frame, text="🦖", font=("Segoe UI Emoji", 36), bg=self.colors['header_bg'], fg="#89dceb").pack(side=tk.LEFT, padx=(0, 5))

        tk.Label(title_frame, text="v1.2.0", font=("Segoe UI", 10), bg=self.colors['header_bg'],
                fg=self.colors['log_text']).pack(side=tk.LEFT, padx=(5, 0))

        # Language selection and manual mode buttons
        lang_frame = tk.Frame(header_content, bg=self.colors['header_bg'])
        lang_frame.pack(side=tk.RIGHT, padx=(20, 0))

        self.en_button = tk.Button(lang_frame, text=" English", font=("Segoe UI", 10),
                                   image=self.icons['en_flag'], compound='left',
                                   bg=self.colors['frame_bg'], fg=self.colors['text'], relief=tk.FLAT,
                                   command=lambda: self.set_language('en'))
        self.en_button.pack(side=tk.LEFT, padx=(0, 5))

        self.zh_button = tk.Button(lang_frame, text=" 中文", font=("Segoe UI", 10),
                                   image=self.icons['zh_flag'], compound='left',
                                   bg=self.colors['frame_bg'], fg=self.colors['text'], relief=tk.FLAT,
                                   command=lambda: self.set_language('zh_CN'))
        self.zh_button.pack(side=tk.LEFT, padx=(0, 10))

        # Show Logs Button
        self.show_logs_button = tk.Button(lang_frame, text=_("📋 Show Logs"),
                                         font=("Segoe UI", 10, "bold"), bg=self.colors['info'],
                                         fg=self.colors['bg'], command=self.show_logs_window,
                                         relief=tk.FLAT, padx=15, pady=5)
        self.show_logs_button.pack(side=tk.LEFT)

        # Connection status indicator
        self.connection_label = tk.Label(header_content, text=_("🔗 SERVER ONLINE"),
                                        font=("Segoe UI", 10), bg=self.colors['success_btn'],
                                        fg=self.colors['bg'], padx=10, pady=2, relief=tk.RAISED)
        self.connection_label.pack(side=tk.RIGHT)

        # Main content area
        content_frame = tk.Frame(self.root, bg=self.colors['bg'])
        content_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)

        # Configuration section
        self.config_frame = tk.LabelFrame(content_frame, text=f" ⚙️ {_('Configuration')} ", font=("Segoe UI", 11, "bold"),
                                    bg=self.colors['frame_bg'], fg=self.colors['text'],
                                    relief=tk.GROOVE, borderwidth=2)
        self.config_frame.pack(fill=tk.X, pady=(0, 15))

        config_inner = tk.Frame(self.config_frame, bg=self.colors['frame_bg'])
        config_inner.pack(fill=tk.X, padx=15, pady=10)

        tk.Label(config_inner, text=_("🎯 Target HW Version:"), font=("Segoe UI", 12, "bold"),
                bg=self.colors['frame_bg'], fg=self.colors['text']).pack(side=tk.LEFT)
        self.version_entry = tk.Entry(config_inner, textvariable=self.hw_version_var,
                                     font=("Consolas", 12), width=15, bg=self.colors['entry_bg'],
                                     fg=self.colors['entry_fg'], insertbackground=self.colors['text'],
                                     relief=tk.FLAT, borderwidth=1, state='readonly')
        self.version_entry.pack(side=tk.LEFT, padx=(15, 10))
        
        # Update button (only if updater is available)
        if DinoUpdater is not None:
            self.update_button = tk.Button(config_inner, text=_("🔄 Check Updates"), font=("Segoe UI", 10, "bold"),
                                          bg=self.colors['warning_btn'], fg=self.colors['bg'],
                                          command=self.check_for_updates, relief=tk.FLAT, padx=15)
            self.update_button.pack(side=tk.LEFT)
        else:
            tk.Label(config_inner, text=_("🔄 Auto-update system not available"), font=("Segoe UI", 9),
                    bg=self.colors['frame_bg'], fg=self.colors['log_text']).pack(side=tk.LEFT, padx=(10, 0))

        # --- Main Control Area ---
        self.control_area = tk.Frame(content_frame, bg=self.colors['bg'])
        self.control_area.pack(fill=tk.X, pady=(0, 15))

        # --- Overall Progress Bar ---
        self.overall_progress_frame = tk.Frame(self.control_area, bg=self.colors['frame_bg'], relief=tk.GROOVE, borderwidth=2)
        self.overall_progress_frame.pack(fill=tk.X, pady=(0, 10))

        progress_inner = tk.Frame(self.overall_progress_frame, bg=self.colors['frame_bg'])
        progress_inner.pack(fill=tk.X, padx=15, pady=10)

        # Hide the step text as requested - only show unified progress bar

        # Unified progress bar with smooth animation
        self.unified_progress_bar = ttk.Progressbar(progress_inner, orient='horizontal', length=100,
                                                   mode='determinate', style="TProgressbar")
        self.unified_progress_bar.pack(fill=tk.X, pady=(0, 5))
        self.unified_progress_bar['value'] = 0

        # Remove the separate flash progress bar - now unified

        # --- Status Display ---
        self.status_label = tk.Label(self.control_area, text="🔌 " + _("Connect ESP32 Device"), font=("Segoe UI", 28, "bold"),
                                    bg=self.colors['status_idle'], fg="white", pady=15, padx=20,
                                    relief=tk.FLAT)
        self.status_label.pack(fill=tk.X, pady=(0, 10))

        # --- Test Results Display ---
        self.results_frame = tk.LabelFrame(self.control_area, text=" 📊 Test Results ", font=("Segoe UI", 12, "bold"),
                                          bg=self.colors['frame_bg'], fg=self.colors['text'],
                                          relief=tk.GROOVE, borderwidth=2)
        # Pack initially but hide - will be shown after testing flash completes
        self.results_frame.pack(fill=tk.X, pady=(0, 10))
        self.results_frame.pack_forget()

        results_inner = tk.Frame(self.results_frame, bg=self.colors['frame_bg'])
        results_inner.pack(fill=tk.X, padx=15, pady=10)

        self.test_result_label = tk.Label(results_inner, text="⏳ Waiting for test results...",
                                        font=("Segoe UI", 14, "bold"), bg=self.colors['frame_bg'],
                                        fg=self.colors['log_text'], justify="center")
        self.test_result_label.pack(fill=tk.X, pady=(0, 10))

        self.test_details_label = tk.Label(results_inner, text="",
                                         font=("Segoe UI", 18, "bold"), bg=self.colors['frame_bg'],
                                         fg=self.colors['text'], justify="left")
        self.test_details_label.pack(fill=tk.X, pady=(0, 5))

        # Try Again button (initially hidden)
        self.try_again_button = tk.Button(results_inner, text="🔄 Try Again", font=("Segoe UI", 12, "bold"),
                                        bg=self.colors['warning_btn'], fg=self.colors['bg'],
                                        command=self.retry_bluetooth_qc, relief=tk.FLAT, padx=20, pady=8)
        # Don't pack it initially - will be shown when test fails

        # Flash New Device button (initially hidden)
        self.flash_new_device_button = tk.Button(results_inner, text="🆕 FLASH NEW DEVICE", font=("Segoe UI", 16, "bold"),
                                               bg=self.colors['success_btn'], fg=self.colors['bg'],
                                               command=self.flash_new_device, relief=tk.FLAT, padx=25, pady=15)
        # Don't pack it initially - will be shown after successful production flash + QC

        # --- Progress Bar removed as requested ---
        # Only unified progress bar at top is kept

        # Track manual mode state
        self.manual_mode = False

        # --- Button Configuration ---
        button_config = {
            'font': ("Segoe UI", 16, "bold"),
            'relief': tk.FLAT,
            'borderwidth': 0,
            'pady': 20
        }

        # --- Flashing Section ---
        self.flash_frame = tk.LabelFrame(self.control_area, text=f" ⚡ {_('Firmware Flashing')} ", font=("Segoe UI", 11, "bold"),
                                    bg=self.colors['frame_bg'], fg=self.colors['text'], relief=tk.GROOVE, borderwidth=2)
        self.flash_frame.pack(fill=tk.X, pady=(10, 5))

        flash_inner = tk.Frame(self.flash_frame, bg=self.colors['frame_bg'])
        flash_inner.pack(fill=tk.X, padx=15, pady=10)

        self.prod_button = tk.Button(flash_inner, text=_("🏭 Flash Production"),
                                    bg=self.colors['prod_btn'], fg=self.colors['bg'],
                                    command=lambda: self.start_flashing('production'), state='disabled', **button_config)
        self.prod_button.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))

        self.test_button = tk.Button(flash_inner, text=_("🧪 Flash Testing & eFuse"),
                                    bg=self.colors['test_btn'], fg=self.colors['bg'],
                                    command=lambda: self.start_flashing('testing'), state='disabled', **button_config)
        self.test_button.pack(side=tk.RIGHT, fill=tk.X, expand=True, padx=(5, 0))

        # --- Quality Control Section ---
        self.qc_frame = tk.LabelFrame(self.control_area, text=f" 🔵 {_('Bluetooth Quality Control (QC)')} ", font=("Segoe UI", 11, "bold"),
                                    bg=self.colors['frame_bg'], fg=self.colors['text'], relief=tk.GROOVE, borderwidth=2)
        self.qc_frame.pack(fill=tk.X, pady=(5, 0))

        qc_inner = tk.Frame(self.qc_frame, bg=self.colors['frame_bg'])
        qc_inner.pack(fill=tk.X, padx=15, pady=10)

        if BT_QC_AVAILABLE and BLEAK_AVAILABLE:
            self.bt_select_button = tk.Button(qc_inner, text=_("📡 Scan & Test Device"),
                                            bg='#f9e2af', fg=self.colors['bg'], # Yellow
                                            command=self.start_manual_bt_selection, state='normal', **button_config)
            self.bt_select_button.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))

            self.bt_qc_button = tk.Button(qc_inner, text=_("▶️ Run QC (After Flash)"),
                                        bg='#7b68ee', fg=self.colors['bg'],  # Medium slate blue
                                        command=self.start_bluetooth_qc, state='disabled', **button_config)
            self.bt_qc_button.pack(side=tk.RIGHT, fill=tk.X, expand=True, padx=(5, 0))
        else:
            # Show disabled buttons if Bluetooth not available
            self.bt_select_button = tk.Button(qc_inner, text=_("📡 BT UNAVAILABLE"),
                                        bg='#6c7086', fg=self.colors['bg'],
                                        state='disabled', **button_config)
            self.bt_select_button.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
            
            self.bt_qc_button = tk.Button(qc_inner, text=_("🔵 BT UNAVAILABLE"),
                                        bg='#6c7086', fg=self.colors['bg'],
                                        state='disabled', **button_config)
            self.bt_qc_button.pack(side=tk.RIGHT, fill=tk.X, expand=True, padx=(5, 0))

        self.show_mode_buttons()

        # Create log viewer (but don't show it in main window)
        self.log_viewer = LogViewer(content_frame, self.colors, self.icons)

        # Create a single log_views dict with a default entry
        self.log_views = {"USB/Serial": self.log_viewer, "Bluetooth": self.log_viewer, "Firebase": self.log_viewer}

        # Start connection monitoring and set initial UI state
        self.update_connection_status()
        self.update_language_buttons()

    def hide_all_ui_elements(self):
        """Hide all UI elements initially, showing only toy ID input"""
        # Hide main frames
        self.config_frame.pack_forget()
        self.flash_frame.pack_forget()
        self.qc_frame.pack_forget()

        # Hide buttons
        self.prod_button.pack_forget()
        self.test_button.pack_forget()
        self.bt_select_button.pack_forget()
        self.bt_qc_button.pack_forget()

        # Update status to show we're starting
        self.status_label.config(text="🚀 Starting DinoCore Production Flasher...", bg=self.colors['status_idle'])

    def is_font_available(self, font_name):
        """Check if a font is available on the system"""
        try:
            test_label = tk.Label(self.root, font=(font_name, 10))
            return True
        except:
            return False

    def update_connection_status(self):
        """Monitor and update connection status - only show when completely offline"""
        try:
            # Check if we can reach the DinoCore API
            response = requests.get("https://dinocore-telemetry-production.up.railway.app/api/status",
                                  timeout=5)
            if response.status_code == 200:
                # Server is online - hide the indicator
                self.connection_label.pack_forget()
            else:
                # Server has issues - hide the indicator (don't show yellow)
                self.connection_label.pack_forget()
        except:
            # Server is completely offline - show error
            self.connection_label.config(text="❌ OFFLINE", bg=self.colors['prod_btn'])
            self.connection_label.pack(side=tk.RIGHT)

        # Update every 30 seconds
        self.root.after(30000, self.update_connection_status)

    def show_mode_buttons(self):
        # This function is now simplified as buttons are always visible
        pass

    def show_stop_button(self):
        # This function is no longer needed
        pass

    def update_log(self):
        while not self.log_queue.empty():
            message_info = self.log_queue.get_nowait()
            
            # --- Write to file log ---
            try:
                with open(self.log_file, "a", encoding="utf-8") as f:
                    f.write(str(message_info).strip() + "\n")
            except Exception as e:
                print(f"Failed to write to log file: {e}") # Fallback to console
            
            # Store raw message for Firebase logging
            self.session_logs.append(str(message_info))

            # Determine target tab and message content
            tab_name = "USB/Serial" # Default tab
            message = message_info

            if isinstance(message_info, tuple):
                if message_info[0] in self.log_views:
                    tab_name, message = message_info
                # This handles progress bar updates without trying to log them as text
                elif message_info[0] in ['progress', 'show_progress', 'hide_progress']:
                    # Progress bar removed - prevent backward movement by only updating if higher
                    if message_info[0] == 'progress':
                        new_progress = message_info[1]
                        self.set_progress_bar_max(new_progress)
                    # show_progress and hide_progress messages are ignored now
                    continue # Skip text logging for this message
                # Handle progress_update messages - update last line instead of adding new entry
                elif message_info[0] == 'progress_update':
                    tab_name, message = "USB/Serial", message_info[1]
                    # Special handling for progress updates - update last line instead of adding new
                    if "Flashing..." in message and "%" in message:
                        log_view = self.log_views[tab_name]
                        log_view.update_last_line(message)
                        continue # Skip normal logging for progress updates
            
            message_str = str(message)
            if "[BLE" in message_str or "Bluetooth" in message_str:
                tab_name = "Bluetooth"
            elif "Firebase" in message_str:
                tab_name = "Firebase"

            log_view = self.log_views[tab_name]

            # Special handling for single-line progress updates
            if "Flashing..." in message_str and "%" in message_str:
                log_view.update_last_line(message_str)
            else:
                # Determine icon for new log entries
                icon = self.icons['info']
                if "[OK]" in message_str or "✅" in message_str or "[SUCCESS]" in message_str:
                    icon = self.icons['success']
                elif "[X]" in message_str or "❌" in message_str or "[ERROR]" in message_str or "[FAILED]" in message_str:
                    icon = self.icons['error']
                elif "[!]" in message_str or "⚠️" in message_str or "[WARNING]" in message_str:
                    icon = self.icons['warning']
                elif "Bluetooth" in message_str or "BLE" in message_str:
                    icon = self.icons['bt']
                elif "Firebase" in message_str:
                    icon = self.icons['firebase']
                elif "Flash" in message_str or "esptool" in message_str:
                    icon = self.icons['flash']
                
                log_view.add_log_entry(message_str, icon)

        self.root.after(100, self.update_log)

    def start_flashing(self, operation, auto_start=False, show_new_device_button=False, skip_efuse_read=False):
        if not self.esp32_port:
            messagebox.showerror(_("Error"), _("No ESP32 device detected."))
            return

        # No confirmation dialogs - just start flashing immediately
        if operation == 'production':
            self.status_label.config(text="🏭 " + _("Flashing Production..."), bg=self.colors['status_prod'])
        else: # testing
            self.status_label.config(text="🧪 " + _("Flashing Testing..."), bg=self.colors['status_test'])

        self.scanner_stop_event.set() # Stop the detector thread

        target_hw_version = self.hw_version_var.get()
        # Pass 'self' to process_device_thread
        flash_thread = threading.Thread(target=process_device_thread, args=(self.log_queue, self.esp32_port, operation, threading.Event(), target_hw_version, self, skip_efuse_read), daemon=True)
        flash_thread.start()

        # Disable buttons during flash
        self.prod_button.config(state='disabled')
        self.test_button.config(state='disabled')
        self.bt_qc_button.config(state='disabled')

        # Monitor thread to re-enable buttons and show new device button if requested
        def monitor_flash_thread():
            flash_thread.join()
            self.scanner_stop_event.clear()
            detector_thread = threading.Thread(target=self.device_detector_worker, daemon=True)
            detector_thread.start()

            # Show "Flash New Device" button after successful production flash + QC
            if show_new_device_button and operation == 'production':
                self.root.after(1000, lambda: self.flash_new_device_button.pack(after=self.test_details_label, pady=(10, 0)))

        monitor_thread = threading.Thread(target=monitor_flash_thread, daemon=True)
        monitor_thread.start()

    def device_detector_worker(self):
        self.esp32_port = None
        last_status = None

        while not self.scanner_stop_event.is_set():
            try:
                port, status = get_esp32_port(self.log_queue)

                if status != last_status:
                    if status == "ESP32_FOUND":
                        self.esp32_port = port
                        self.log_queue.put(f"✅ ESP32 detected on port {port}")
                        self.status_label.config(text="✅ " + _("ESP32 Ready on {}").format(port), bg=self.colors['status_success'])

                        # Update connection status if connection frame exists
                        if hasattr(self, 'connection_status_label'):
                            self.connection_status_label.config(text="✅ Device detected and ready!", fg=self.colors['success_btn'])

                        self.prod_button.config(state='normal')
                        self.test_button.config(state='normal')
                        self.bt_qc_button.config(state='normal')
                    elif status == "NO_ESP32_FOUND":
                        self.esp32_port = None
                        self.status_label.config(text="🔌 " + _("Connect ESP32 Device"), bg=self.colors['status_idle'])

                        # Update connection status if connection frame exists
                        if hasattr(self, 'connection_status_label'):
                            self.connection_status_label.config(text="⏳ Waiting for device...", fg=self.colors['log_text'])

                        self.prod_button.config(state='disabled')
                        self.test_button.config(state='disabled')
                        self.bt_qc_button.config(state='disabled')
                    elif status == "MULTIPLE_ESP32_FOUND":
                        self.esp32_port = None
                        self.status_label.config(text="⚠️ " + _("Multiple ESP32s Detected"), bg=self.colors['status_warning'])

                        # Update connection status if connection frame exists
                        if hasattr(self, 'connection_status_label'):
                            self.connection_status_label.config(text="⚠️ Multiple devices detected. Disconnect all except one.", fg=self.colors['warning_btn'])

                        self.prod_button.config(state='disabled')
                        self.test_button.config(state='disabled')
                        self.bt_qc_button.config(state='disabled')
                    last_status = status

            except Exception as e:
                self.log_queue.put(f"[X] Error in device detection: {e}")
                time.sleep(2)  # Continue scanning even if there's an error

            time.sleep(2)

    def set_language(self, lang_code):
        """Set the application language and update UI."""
        # Removed debug prints to prevent log flooding in production

        if translation_manager.set_language_global(lang_code):
            # Language set successfully - no debug print

            # Verify global _ function works
            test_string = _("DinoCore Production Flasher v1.2.0")
            print(f"[DEBUG] Test translation result: '{test_string}'")

            self.log_queue.put(f"🌐 Language changed to {lang_code} - refreshing all UI texts")
            self.root.after(100, lambda: self.update_all_widgets(self.root))  # Small delay to ensure language change propagates
        else:
            print(f"❌ [DEBUG] Failed to set language to: {lang_code}")
            self.log_queue.put(f"⚠️ Failed to change language to {lang_code}")
            messagebox.showerror(_("Error"), _("Failed to change language"))

    def start_flash_progress_animation(self):
        """Removed - now top bar first 50% mirrors actual bottom bar progress"""
        pass  # No longer needed - progress mirroring is handled in update_log

    def start_bluetooth_progress_animation(self):
        """Start Bluetooth QC phase animation (50% to 100%) over estimated BT time"""
        # Get current progress value to avoid backward movement
        current_progress = self.unified_progress_bar['value']

        # Ensure we're at least at 50% before starting BT phase
        if current_progress < 50:
            current_progress = 50

        # Set initial value to at least 50% to start BT phase (using max function)
        self.set_progress_bar_max(current_progress)

        # Estimated Bluetooth QC time in seconds (set to 26 seconds as requested)
        estimated_bt_time = 26

        # Animate from current progress to 100% over the estimated time
        remaining_steps = 100 - current_progress
        if remaining_steps <= 0:
            return  # Already at or above 100%

        step_duration = int((estimated_bt_time * 1000) // remaining_steps)  # milliseconds per step - ensure integer

        def animate_step(current_value):
            if current_value <= 100:
                # Only update if this value is higher than current (prevents backward movement)
                self.set_progress_bar_max(current_value)
                self.root.after(step_duration, lambda: animate_step(current_value + 1))

        animate_step(current_progress)

    def reset_progress_bar(self):
        """Reset the unified progress bar to 0%"""
        self.unified_progress_bar['value'] = 0

    def set_progress_bar_max(self, new_value):
        """Set progress bar value only if it's higher than current value (prevents backward movement)"""
        current = self.unified_progress_bar['value']
        if new_value > current:
            self.unified_progress_bar['value'] = new_value

    def set_progress_bar_max_both(self, new_value):
        """Set unified progress bar to new value only if it's higher than current value"""
        current_unified = self.unified_progress_bar['value']

        if new_value > current_unified:
            self.unified_progress_bar['value'] = new_value

    def update_language_buttons(self):
        """Update the visual state of language buttons."""
        current_lang = translation_manager.get_current_language()
        if current_lang == 'en':
            self.en_button.config(relief=tk.SUNKEN, bg=self.colors['highlight'])
            self.zh_button.config(relief=tk.FLAT, bg=self.colors['frame_bg'])
        elif current_lang.startswith('zh'):
            self.zh_button.config(relief=tk.SUNKEN, bg=self.colors['highlight'])
            self.en_button.config(relief=tk.FLAT, bg=self.colors['frame_bg'])

    def check_for_updates(self):
        """Check for updates and show results in log"""
        if DinoUpdater is None:
            messagebox.showerror(_("Error"), _("Update system is not available"))
            return

        # Disable the update button during check
        self.update_button.config(state='disabled', text=_("🔄 Checking..."))

        def update_check_thread():
            try:
                updater = DinoUpdater()
                update_info = updater.check_for_updates()

                if update_info:
                    # Show update available dialog
                    changelog = update_info['changelog'][:300] + "..." if len(update_info['changelog']) > 300 else update_info['changelog']
                    message = _(f"Update available: {update_info['version']}\n\nChanges:\n{changelog}\n\nDo you want to install this update?")

                    # Use after() to show dialog in main thread
                    def show_update_dialog():
                        if messagebox.askyesno(_("Update Available"), message):
                            self.perform_update(update_info)
                        else:
                            self.log_queue.put(_("Update cancelled by user"))
                            self.update_button.config(state='normal', text=_("🔄 Check Updates"))

                    self.root.after(0, show_update_dialog)
                else:
                    self.log_queue.put(_("✅ You are using the latest version"))
                    self.root.after(0, lambda: self.update_button.config(state='normal', text=_("🔄 Check Updates")))

            except Exception as e:
                self.log_queue.put(_(f"[X] Update check failed: {e}"))
                self.root.after(0, lambda: self.update_button.config(state='normal', text=_("🔄 Check Updates")))

        # Start update check in background thread
        thread = threading.Thread(target=update_check_thread, daemon=True)
        thread.start()

    def perform_update(self, update_info):
        """Perform the actual update"""
        # Disable button and show progress
        self.update_button.config(state='disabled', text=_("⬆️ Updating..."))

        def update_thread():
            try:
                updater = DinoUpdater()
                if updater.update(auto_confirm=True):
                    self.log_queue.put(_("✅ Update completed! Please restart the application."))
                    messagebox.showinfo(_("Success"), _("Update completed successfully!\n\nPlease restart the application to use the new version."))
                else:
                    self.log_queue.put(_("[X] Update failed or was cancelled"))
                    messagebox.showerror(_("Error"), _("Update failed. Check the log for details."))
            except Exception as e:
                self.log_queue.put(_(f"[X] Update error: {e}"))
                messagebox.showerror(_("Error"), _("Update failed. Check the log for details."))

            # Re-enable button
            self.root.after(0, lambda: self.update_button.config(state='normal', text=_("🔄 Check Updates")))

        # Start update in background thread
        thread = threading.Thread(target=update_thread, daemon=True)
        thread.start()

    def start_bluetooth_qc(self):
        """Start Bluetooth QC testing mode"""
        # Use the Bluetooth QC Manager's method which has access to the necessary globals
        self.bluetooth_qc_manager.start_bluetooth_qc()

    def start_manual_bt_selection(self):
        """Wrapper to run the async device selection process."""
        self.bluetooth_qc_manager.start_manual_bt_selection()

    def display_test_results(self, results):
        """Display QC test results in main window and logs, then send to API and show button"""
        # Update main window display
        pass_count = sum(1 for r in results if r['status'] == 'pass')
        total_count = len(results)
        all_passed = pass_count == total_count

        # Extract RMS values for prominent display
        rms_info = ""
        for result in results:
            if 'evaluation_data' in result:
                eval_data = result['evaluation_data']
                if 'rms_L' in eval_data and 'rms_R' in eval_data:
                    rms_L = eval_data['rms_L']
                    rms_R = eval_data['rms_R']
                    balance = rms_L / max(rms_R, 0.001)
                    balance_status = "Balanced 🎵" if (balance > 0.9 and balance < 1.1) else "Unbalanced ⚠️"
                    rms_info = f"🎤 RMS Values: L={rms_L:.1f}, R={rms_R:.1f} ({balance_status})\n"
                    break

        if all_passed:
            self.test_result_label.config(text="🎉 DEVICE APPROVED!",
                                        fg=self.colors['success_btn'], font=("Segoe UI", 16, "bold"))
            details_text = "✅ Device passed quality control.\nReady for next device!"
            self.test_details_label.config(text=details_text, fg=self.colors['success_btn'])
        else:
            self.test_result_label.config(text="⚠️ DEVICE REQUIRES ATTENTION",
                                        fg=self.colors['warning_btn'], font=("Segoe UI", 16, "bold"))
            instructions = "🔧 Please check the microphones and readjust the plush's felt/fabric:\n\n   1. Open the plush toy carefully\n   2. Check microphone connections\n   3. Ensure microphones are properly positioned\n   4. Re-adjust the felt/fabric padding\n   5. Close the toy and run QC again"
            self.test_details_label.config(text=instructions, fg=self.colors['warning_btn'])

        # Also log to console/logs (but don't show technical details in main window)
        self.log_queue.put("\n🎯 QA TEST RESULTS:")
        self.log_queue.put("=" * 50)

        for result in results:
            status_icon = "✅" if result['status'] == 'pass' else "❌"
            self.log_queue.put(f"Test: {result['name']}")
            self.log_queue.put(f"Result: {status_icon} {result['status'].upper()}")

            if 'details' in result:
                self.log_queue.put(f"Details: {result['details']}")

            if 'evaluation_data' in result:
                eval_data = result['evaluation_data']
                if 'rms_L' in eval_data and 'rms_R' in eval_data:
                    balance = eval_data['rms_L'] / max(eval_data['rms_R'], 0.001)
                    if balance > 0.9 and balance < 1.1:
                        balance_status = "Balanced 🎵"
                    else:
                        balance_status = "Unbalanced ⚠️"
                    self.log_queue.put(f"Audio Balance: {balance_status}")
                    self.log_queue.put(f"RMS L: {eval_data['rms_L']:.1f}")
                    self.log_queue.put(f"RMS R: {eval_data['rms_R']:.1f}")

            self.log_queue.put("-" * 30)

        self.log_queue.put(f"Summary: {pass_count}/{total_count} tests passed")

        if all_passed:
            self.log_queue.put("🎉 ALL TESTS PASSED - Device approved!")

            # Send data to Bondu API after successful QC - only if not already sent
            toy_id_to_use = getattr(self, 'processed_toy_id', self.toy_id_var.get())
            if API_AVAILABLE and toy_id_to_use and self.physical_id and not self.api_payload_sent:
                # Sanitize logs to avoid Unicode escape sequence errors
                logs_content = "\n".join(self.session_logs)
                
                # Comprehensive sanitization to prevent JSON encoding issues
                # 1. Replace all backslashes with forward slashes
                logs_content = logs_content.replace('\\', '/')
                # 2. Remove or replace other problematic characters
                logs_content = logs_content.replace('\r', '')  # Remove carriage returns
                logs_content = logs_content.replace('\t', '    ')  # Replace tabs with spaces
                # 3. Remove control characters (ASCII 0-31 except newline)
                logs_content = ''.join(char for char in logs_content if ord(char) >= 32 or char == '\n')
                # 4. Encode to ASCII, replacing non-ASCII with '?'
                logs_content = logs_content.encode('ascii', 'replace').decode('ascii')
                # 5. Remove any remaining problematic escape sequences
                logs_content = logs_content.replace('\\x', '_x')
                logs_content = logs_content.replace('\\u', '_u')

                api_success, api_error_msg, api_full_error = send_to_bondu(
                    toy_id=toy_id_to_use,
                    mac_address=self.physical_id.replace(':', '').lower(),
                    test_data={"logs": logs_content}
                )

                if api_success:
                    self.log_queue.put("✅ Data sent to Bondu API successfully")
                    self.api_payload_sent = True
                    
                    # Show Flash New Device button immediately after successful API transmission
                    self.show_flash_new_device_button()
                else:
                    self.log_queue.put(f"❌ Failed to send data to Bondu API: {api_error_msg}")
                    self.display_api_error(api_error_msg)
            elif self.api_payload_sent:
                self.log_queue.put("📡 API data already sent for this device, skipping duplicate transmission")
                # Still show button if already sent
                self.show_flash_new_device_button()

            # Store structured session data after successful QC
            if FIREBASE_AVAILABLE and toy_id_to_use and self.physical_id:
                session_data = {
                    'toy_id': toy_id_to_use,
                    'physical_id': self.physical_id,
                    'qc_results': results,
                    'session_start': time.time() - 600,
                    'session_end': time.time(),
                    'qc_passed': True,
                    'device_name': self.captured_ble_name or 'Unknown'
                }

                if store_device_session(session_data):
                    self.log_queue.put("💾 Device session data stored in Firebase")
                else:
                    self.log_queue.put("⚠️ Failed to store device session data")
        else:
            self.log_queue.put("⚠️ SOME TESTS FAILED - Device requires attention")
            self.log_queue.put("🔧 Please check the microphones and readjust the plush's felt/fabric")

        self.log_queue.put("=" * 50)

        # Show/hide Try Again button based on results
        if not all_passed:
            self.try_again_button.pack(after=self.test_details_label, pady=(10, 0))
            self.log_queue.put("🔄 Try Again button shown - user can retry Bluetooth QC")
        else:
            # Hide the button if tests passed
            if hasattr(self, 'try_again_button'):
                self.try_again_button.pack_forget()

        return all_passed

    def flash_new_device(self):
        """Reset the workflow to flash a new device"""
        self.log_queue.put("🆕 User clicked 'Flash New Device' - resetting workflow...")

        # Hide the Flash New Device button
        if hasattr(self, 'flash_new_device_button'):
            self.flash_new_device_button.pack_forget()

        # Reset workflow state
        self.workflow_step = 0
        self.physical_id = None
        self.captured_ble_name = None
        self.toy_id_var.set("")

        # Clear test results
        self.test_result_label.config(text="⏳ Waiting for test results...",
                                    fg=self.colors['log_text'], font=("Segoe UI", 20, "bold"))
        self.test_details_label.config(text="", fg=self.colors['text'])

        # Reset progress bar for next device
        self.reset_progress_bar()

        # Hide all UI elements and restart workflow
        self.hide_all_ui_elements()
        self.root.after(200, self.ask_toy_id)

    def retry_bluetooth_qc(self):
        """Retry the Bluetooth QC test when it fails"""
        self.log_queue.put("🔄 User clicked 'Try Again' - restarting Bluetooth QC...")

        # Hide the Try Again button while retrying
        self.try_again_button.pack_forget()

        # Reset test results display
        self.test_result_label.config(text="⏳ Retrying Bluetooth QC...",
                                    fg=self.colors['log_text'], font=("Segoe UI", 14, "bold"))
        self.test_details_label.config(text="Please wait while we retry the Bluetooth quality control test...",
                                     fg=self.colors['log_text'])

        # Start Bluetooth QC again
        self.start_bluetooth_qc()

    def show_logs_window(self):
        """Show logs in a separate window"""
        # Create a new window for logs
        logs_window = tk.Toplevel(self.root)
        logs_window.title("📋 System Logs - DinoCore Production Flasher")
        logs_window.geometry("900x600")
        logs_window.configure(bg=self.colors['bg'])
        logs_window.resizable(True, True)

        # Center the window
        logs_window.update_idletasks()
        x = (logs_window.winfo_screenwidth() - logs_window.winfo_width()) // 2
        y = (logs_window.winfo_screenheight() - logs_window.winfo_height()) // 2
        logs_window.geometry(f"+{x}+{y}")

        # Header
        header_frame = tk.Frame(logs_window, bg=self.colors['header_bg'], height=50)
        header_frame.pack(fill=tk.X, padx=0, pady=0)
        header_frame.pack_propagate(False)

        tk.Label(header_frame, text="📋 System Logs",
                font=("Segoe UI", 16, "bold"), bg=self.colors['header_bg'],
                fg=self.colors['text']).pack(pady=10)

        # Create a new LogViewer instance for the separate window
        logs_viewer = LogViewer(logs_window, self.colors, self.icons)
        logs_viewer.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # Copy all current log entries to the new viewer
        # Get all text from the main log viewer
        main_log_text = self.log_viewer.text_widget.get("1.0", tk.END).strip()
        if main_log_text:
            # Split by lines and add each line to the new viewer
            for line in main_log_text.split('\n'):
                if line.strip():  # Only add non-empty lines
                    logs_viewer.add_log_entry(line.strip())

        # Make the window modal (blocks interaction with main window)
        logs_window.transient(self.root)
        logs_window.grab_set()

        # Focus on the logs window
        logs_window.focus_set()
    def show_flash_new_device_button(self):
        """Show the Flash New Device button after successful QC and API transmission"""
        try:
            if hasattr(self, 'flash_new_device_button'):
                self.log_queue.put("🔧 Showing Flash New Device button...")
                self.flash_new_device_button.pack(after=self.test_details_label, pady=(10, 0))
                self.log_queue.put("✅ Flash New Device button is now visible")
            else:
                self.log_queue.put("❌ ERROR: flash_new_device_button not found")
        except Exception as e:
            self.log_queue.put(f"❌ ERROR showing Flash New Device button: {e}")

    def update_all_widgets_text(self):
        """Update all interface texts after language change - TARGETED approach."""
        print("[TRANSLATION] Starting targeted UI text update...")

        # Get current language
        current_lang = translation_manager.get_current_language()
        print(f"[TRANSLATION] Current language: {current_lang}")

        # Force update global translation function
        global _
        _ = translation_manager._

        try:
            # Update window title
            self.root.title(_("DinoCore Production Flasher v1.2.0"))
            print("[TRANSLATION] Window title updated")

            # Update status label
            if hasattr(self, 'status_label') and self.status_label.winfo_exists():
                current_text = self.status_label.cget("text")

                if "Enter Toy ID" in current_text:
                    new_text = _("Enter Toy ID")
                    self.status_label.config(text=new_text)
                elif "输入玩具" in current_text:
                    new_text = _("Enter Toy ID")
                    self.status_label.config(text=new_text)
                elif "ESP32 Ready on" in current_text:
                    import re
                    port_match = re.search(r'COM\d+', current_text)
                    if port_match:
                        port = port_match.group(0)
                        new_text = _("ESP32 Ready on {}").format(port)
                        self.status_label.config(text=new_text)

            # Update Show Logs button
            if hasattr(self, 'show_logs_button') and self.show_logs_button.winfo_exists():
                current_text = self.show_logs_button.cget("text")

                if "Show Logs" in current_text:
                    new_text = _("📋 Show Logs")
                    self.show_logs_button.config(text=new_text)
                    print(f"✅ [TRANSLATION] Show Logs button updated to: '{new_text}'")
                elif "显示日志" in current_text:
                    new_text = _("📋 Show Logs")
                    self.show_logs_button.config(text=new_text)
                    print("TRANSLATION: Show Logs button updated")  # Shortened for production

            # Update toy ID elements if they exist
            if hasattr(self, 'toy_id_frame') and self.toy_id_frame.winfo_exists():

                # Find all labels in the toy ID frame
                def find_labels_in_frame(frame):
                    labels = []
                    for child in frame.winfo_children():
                        if isinstance(child, tk.Frame):
                            labels.extend(find_labels_in_frame(child))
                        elif isinstance(child, tk.Label):
                            labels.append(child)
                    return labels

                labels = find_labels_in_frame(self.toy_id_frame)

                for label in labels:
                    current_text = label.cget("text")

                    if "Scan Toy ID" in current_text:
                        new_text = _("Scan Toy ID")
                        label.config(text=new_text)

                # Find all buttons in the toy ID frame
                def find_buttons_in_frame(frame):
                    buttons = []
                    for child in frame.winfo_children():
                        if isinstance(child, tk.Frame):
                            buttons.extend(find_buttons_in_frame(child))
                        elif isinstance(child, tk.Button):
                            buttons.append(child)
                    return buttons

                buttons = find_buttons_in_frame(self.toy_id_frame)

                for button in buttons:
                    current_text = button.cget("text")

                    if "OK" in current_text:
                        new_text = _("OK")
                        button.config(text=new_text)

            # Update connection elements if they exist
            if hasattr(self, 'connection_frame') and self.connection_frame.winfo_exists():

                # Update connection status label
                if hasattr(self, 'connection_status_label') and self.connection_status_label.winfo_exists():
                    current_text = self.connection_status_label.cget("text")

                    if "Waiting for device" in current_text:
                        new_text = _("Waiting for device...")
                        self.connection_status_label.config(text=new_text)

                # Update connection OK button
                if hasattr(self, 'connection_ok_button') and self.connection_ok_button.winfo_exists():
                    current_text = self.connection_ok_button.cget("text")

                    if "Device Ready" in current_text:
                        new_text = _("Device Ready")
                        self.connection_ok_button.config(text=new_text)

            # Update language buttons
            self.update_language_buttons()

        except Exception as e:
            print(f"TRANSLATION ERROR: {e}")  # Minimal error reporting

    def update_all_widgets(self, parent):
        """Recursively update all widgets with translation function"""
        try:
            for child in parent.winfo_children():
                if isinstance(child, tk.Frame):
                    self.update_all_widgets(child)
                elif isinstance(child, (tk.Label, tk.Button)):
                    current_text = child.cget("text")
                    if current_text:
                        # Try to translate common UI elements
                        if current_text == "Scan Toy ID":
                            child.config(text=_("Scan Toy ID"))
                        elif current_text == "扫描玩具 ID":
                            child.config(text=_("Scan Toy ID"))
                        elif current_text == "OK":
                            child.config(text=_("OK"))
                        elif current_text == "确定":
                            child.config(text=_("OK"))
                        elif current_text == "Show Logs":
                            child.config(text=_("📋 Show Logs"))
                        elif current_text == "显示日志":
                            child.config(text=_("📋 Show Logs"))
                        elif current_text == "Device Ready":
                            child.config(text=_("✅ Device Ready"))
                        elif current_text == "设备就绪":
                            child.config(text=_("✅ Device Ready"))
                        elif current_text == "Waiting for device...":
                            child.config(text=_("⏳ Waiting for device..."))
                        elif current_text == "等待设备...":
                            child.config(text=_("⏳ Waiting for device..."))
                        elif current_text == "Device detected and ready!":
                            child.config(text=_("✅ Device detected and ready!"))
                        elif current_text == "设备检测就绪！":
                            child.config(text=_("✅ Device detected and ready!"))
        except Exception as e:
            print(f"⚠️ [TRANSLATION] Error in widget update: {e}")

    def display_api_error(self, api_error_msg):
        """Display CRITICAL API error in main window and block workflow until resolved"""
        # Show critical error status
        self.status_label.config(text="CRITICAL: API ERROR - WORKFLOW BLOCKED", bg=self.colors['prod_btn'], font=("Segoe UI", 32, "bold"))

        # Update test results to show API failure
        self.test_result_label.config(text="API TRANSMISSION FAILED", fg=self.colors['prod_btn'], font=("Segoe UI", 24, "bold"))

        # Show detailed error message and instructions
        error_details = f"""CRITICAL BUSINESS ERROR

- Could not send device data to Bondu API
- Inventory tracking is NOT updated
- Device workflow BLOCKED until resolved

Error Details: {api_error_msg}

IMMEDIATE ACTION REQUIRED:
1. Check network connection
2. Verify API server status
3. Contact technical support
4. Click 'RETRY API TRANSMISSION' below

WARNING: DO NOT PROCESS ANY MORE DEVICES until this is resolved!

NOTE: The next device processing button will appear ONLY after
successful API transmission."""

        self.test_details_label.config(text=error_details, fg=self.colors['prod_btn'], font=("Segoe UI", 14), justify="left")

        # Add critical error button frame
        self.api_error_frame = tk.Frame(self.results_frame, bg=self.colors['frame_bg'])
        self.api_error_frame.pack(fill=tk.X, pady=(20, 0), after=self.test_details_label)

        # Sound critical error alert
        for _ in range(3):
            play_sound(ERROR_FREQ, ERROR_DUR)
            self.root.after(200)  # Small delay between beeps

        # Critical retry button (large and red)
        self.retry_api_button = tk.Button(
            self.api_error_frame,
            text="🔄 RETRY API TRANSMISSION",
            font=("Segoe UI", 20, "bold"),
            bg=self.colors['prod_btn'],
            fg="white",
            relief=tk.FLAT,
            padx=30,
            pady=20,
            command=self.retry_api_transmission
        )
        self.retry_api_button.pack(fill=tk.X, padx=20, pady=(0, 10))

        # Emergency logs button
        self.check_logs_button = tk.Button(
            self.api_error_frame,
            text="📋 Check System Logs",
            font=("Segoe UI", 12, "bold"),
            bg=self.colors['warning_btn'],
            fg=self.colors['bg'],
            relief=tk.FLAT,
            padx=20,
            pady=8,
            command=self.show_logs_window
        )
        self.check_logs_button.pack(pady=(0, 10))

        # Log the critical error
        self.log_queue.put("🚨 CRITICAL: Device workflow blocked due to API transmission failure")
        self.log_queue.put(f"🚨 Error: {api_error_msg}")
        self.log_queue.put("🚨 Operator must resolve API issue before continuing production")

    def retry_api_transmission(self):
        """Retry API transmission for the current device"""
        self.log_queue.put("🔄 Operator clicked 'Retry API Transmission'")

        # Update UI to show retry in progress
        self.retry_api_button.config(text="⏳ Retrying...", state='disabled')
        self.status_label.config(text="⏳ Retrying API transmission...", bg=self.colors['warning_btn'])

        # Retry the API transmission in a separate thread
        def retry_thread():
            try:
                # Get the current device data
                if hasattr(self, 'processed_toy_id') and self.processed_toy_id and self.physical_id:
                    logs_content = "\n".join(self.session_logs)
                    test_data = {"logs": logs_content}

                    # Try API transmission - for retries, we allow resending
                    if API_AVAILABLE:
                        api_success, api_error_msg, api_full_error = send_to_bondu(
                            toy_id=self.processed_toy_id,
                            mac_address=self.physical_id.replace(':', '').lower(),
                            test_data=test_data
                        )

                        if api_success:
                            # SUCCESS - Clear error state and allow continuation
                            self.log_queue.put("✅ API transmission retry successful!")
                            self.api_payload_sent = True  # Mark as sent after successful retry
                            self.root.after(0, self.clear_api_error_and_continue)
                        else:
                            # Still failed - Update error message
                            self.log_queue.put("❌ API transmission retry failed")
                            self.log_queue.put(f"❌ Error: {api_error_msg}")
                            self.root.after(0, lambda: self.update_api_error_message(api_error_msg))
                    else:
                        self.log_queue.put("⚠️ API not available - cannot retry")
                        self.root.after(0, self.clear_api_error_and_continue)  # Allow continuation if API won't be used
                else:
                    self.log_queue.put("⚠️ No device data available to retry")
                    self.root.after(0, self.clear_api_error_and_continue)  # Allow continuation

            except Exception as e:
                error_msg = f"Exception during API retry: {str(e)}"
                self.log_queue.put(f"❌ {error_msg}")
                self.root.after(0, lambda: self.update_api_error_message(error_msg))

        # Start retry in background thread
        retry_thread = threading.Thread(target=retry_thread, daemon=True)
        retry_thread.start()

    def update_api_error_message(self, error_msg):
        """Update the API error message display"""
        error_details = f"""🚨 CRITICAL BUSINESS ERROR 🚨

❌ Could not send device data to Bondu API
❌ Inventory tracking is NOT updated
❌ Device workflow BLOCKED until resolved

📋 Updated Error Details: {error_msg}

🔧 IMMEDIATE ACTION REQUIRED:
1. Check network connection
2. Verify API server status
3. Contact technical support
4. Click 'RETRY API TRANSMISSION' below

⚠️ DO NOT PROCESS ANY MORE DEVICES until this is resolved!"""

        self.test_details_label.config(text=error_details, fg=self.colors['prod_btn'], font=("Segoe UI", 14), justify="left")

        # Re-enable retry button
        self.retry_api_button.config(text="🔄 RETRY API TRANSMISSION", state='normal')

        # Reset status
        self.status_label.config(text="🚨 CRITICAL: API ERROR - WORKFLOW BLOCKED", bg=self.colors['prod_btn'])

        # Sound error again (but once)
        play_sound(ERROR_FREQ, ERROR_DUR)

    def _show_flash_new_device_button(self):
        """Internal method to show the Flash New Device button with debugging."""
        try:
            if hasattr(self, 'flash_new_device_button'):
                self.log_queue.put("🔧 DEBUG: Attempting to show Flash New Device button...")
                self.flash_new_device_button.pack(after=self.test_details_label, pady=(10, 0))
                self.log_queue.put("✅ DEBUG: Flash New Device button should now be visible")
                self.log_queue.put(f"🔍 DEBUG: Button is mapped: {self.flash_new_device_button.winfo_ismapped()}")
                self.log_queue.put(f"🔍 DEBUG: Button is viewable: {self.flash_new_device_button.winfo_viewable()}")
            else:
                self.log_queue.put("❌ DEBUG: Cannot show button - flash_new_device_button attribute missing")
        except Exception as e:
            self.log_queue.put(f"❌ DEBUG: Error showing Flash New Device button: {e}")

    def clear_api_error_and_continue(self):
        """Clear API error state and allow workflow to continue"""
        self.log_queue.put("✅ API error resolved - workflow can continue")

        # Clear error display
        if hasattr(self, 'api_error_frame'):
            self.api_error_frame.pack_forget()
            delattr(self, 'api_error_frame')

        # Reset status to success
        self.status_label.config(text="🎉 DEVICE WORKFLOW COMPLETED - Ready for next device", bg=self.colors['success_btn'], font=("Segoe UI", 28, "bold"))

        # Update result display
        self.test_result_label.config(text="🎉 DEVICE APPROVED!", fg=self.colors['success_btn'], font=("Segoe UI", 16, "bold"))
        self.test_details_label.config(text="✅ Device passed quality control.\n✅ API data transmission successful.\nReady for next device!", fg=self.colors['success_btn'])

        # Show the Flash New Device button (now that API transmission succeeded)
        self.root.after(2000, lambda: self.flash_new_device_button.pack(after=self.test_details_label, pady=(10, 0)))

        # Sound success
        for _ in range(2):
            play_sound(END_FREQ, END_DUR)
            self.root.after(300)  # Delay between success sounds
