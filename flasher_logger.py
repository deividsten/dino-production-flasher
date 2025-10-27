#!/usr/bin/env python3
"""
DinoCore Production Flasher - Logging Wrapper
This script starts logging immediately and wraps the application startup
to ensure logs are always captured, even if the application fails
"""

import os
import sys
import time
import platform
import datetime
import subprocess
import threading
from firebase_db import store_session_log, init_firebase_with_credentials

class FlasherLogger:
    """Wrapper that starts logging and launches the application"""

    def __init__(self):
        self.start_time = time.time()
        self.session_logs = []
        self.logging_active = False

    def log(self, message: str, level: str = "INFO", immediate_store: bool = False):
        """Log a message with timestamp"""
        timestamp = datetime.datetime.now().isoformat()
        full_message = f"[{timestamp}] [{level}] {message}"

        print(f"🎯 LOG: {full_message}")
        self.session_logs.append(full_message)

        if immediate_store and self.logging_active:
            try:
                store_session_log([full_message])
            except Exception as e:
                print(f"❌ Failed to store log: {e}")

    def start_logging_system(self):
        """Initialize Firebase logging system"""
        self.log("🔍 Initializing logging system...")

        try:
            if init_firebase_with_credentials():
                self.logging_active = True
                self.log("✅ Firebase logging active")
                return True
            else:
                self.log("⚠️ Firebase not available - continuing without remote logging", "WARNING")
                return False
        except Exception as e:
            self.log(f"❌ Firebase initialization error: {e}", "ERROR")
            return False

    def collect_system_info(self):
        """Collect and log system information"""
        self.log("📊 Collecting system information...")
        self.log(f"Platform: {platform.system()} {platform.release()}")
        self.log(f"Python: {sys.version}")
        self.log(f"Working directory: {os.getcwd()}")

        # Check if firebase credentials exist
        creds_file = "firebase-credentials.json"
        if os.path.exists(creds_file):
            self.log(f"✅ Firebase credentials found: {creds_file}")
        else:
            self.log(f"⚠️ Firebase credentials NOT found: {creds_file}", "WARNING")

    def launch_application(self):
        """Launch the main GUI application"""
        try:
            self.log("🚀 Launching DinoCore Production Flasher GUI...")

            # Use subprocess to run the application
            # This allows the wrapper to continue monitoring
            result = subprocess.run([
                sys.executable, 'gui_flasher.py'
            ], cwd=os.getcwd())

            exit_code = result.returncode
            self.log(f"📋 Application finished with exit code: {exit_code}")

            if exit_code != 0:
                self.log("⚠️ Application exited with non-zero code - may indicate errors", "WARNING")

            return exit_code

        except Exception as e:
            self.log("💥 CRITICAL ERROR launching application: {e}", "ERROR")
            return -1

    def finalize_and_store_logs(self):
        """Finalize logging session and store all collected logs"""
        end_time = time.time()
        duration = end_time - self.start_time

        self.log(f"Session duration: {duration:.1f} seconds")
        self.log(f"Total logs collected: {len(self.session_logs)}")

        if self.logging_active and self.session_logs:
            try:
                self.log("💾 Storing session logs to Firebase...")
                if store_session_log(self.session_logs):
                    self.log("✅ Session logs stored successfully")
                else:
                    self.log("❌ Failed to store session logs", "ERROR")
            except Exception as e:
                self.log(f"❌ Exception during log storage: {e}", "ERROR")
        else:
            self.log("⚠️ Firebase logging not active - skipping log storage")

    def run(self):
        """Main entry point"""
        print("🦕 DinoCore Production Flasher - Logging Wrapper")
        print("=" * 55)

        try:
            # Step 1: Initialize logging
            self.start_logging_system()

            # Step 2: Collect system info
            self.collect_system_info()

            # Step 3: Launch application
            exit_code = self.launch_application()

            # Step 4: Finalize and store logs
            self.finalize_and_store_logs()

            print("=" * 55)
            print("✅ Logging wrapper completed successfully")
            return exit_code

        except KeyboardInterrupt:
            self.log("⏹️ Logging wrapper interrupted by user", "WARNING")
            self.finalize_and_store_logs()
            return 130

        except Exception as e:
            self.log("💥 CRITICAL ERROR in logging wrapper: {e}", "ERROR")
            self.finalize_and_store_logs()
            return -1

if __name__ == "__main__":
    wrapper = FlasherLogger()
    exit_code = wrapper.run()

    print(f"\nWrapper exit code: {exit_code}")
    sys.exit(exit_code)
