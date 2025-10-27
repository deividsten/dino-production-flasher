#!/usr/bin/env python3
"""
DinoCore Production Flasher - Firebase Database Module
Handles Firebase/Firestore integration for storing test results and logs
"""

import os
import json
import time
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

# Firebase imports with fallback
try:
    import firebase_admin
    from firebase_admin import credentials, firestore, initialize_app
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    firebase_admin = None

from i18n_utils import _

class FirebaseDB:
    """Firebase/Firestore database manager for DinoCore"""

    def __init__(self):
        self.db = None
        self.initialized = False
        self.project_id = None

    def initialize(self, credentials_path: str = None, project_id: str = None) -> bool:
        """Initialize Firebase connection"""
        if not FIREBASE_AVAILABLE:
            print(_("Firebase not available - install firebase-admin: pip install firebase-admin"))
            return False

        try:
            # Use provided credentials or look for default paths
            if credentials_path and os.path.exists(credentials_path):
                cred = credentials.Certificate(credentials_path)
            else:
                # Try common Firebase credentials locations
                possible_paths = [
                    'production_flasherv1.2/firebase-credentials.json',
                    'firebase-credentials.json',
                    'credentials.json',
                    'firebase-adminsdk.json',
                    os.path.expanduser('~/.firebase/credentials.json'),
                    os.path.expanduser('~/firebase-credentials.json')
                ]

                cred = None
                for path in possible_paths:
                    if os.path.exists(path):
                        cred = credentials.Certificate(path)
                        print(f"Found Firebase credentials at: {path}")
                        break

                if not cred:
                    print(_("Firebase credentials not found. Please provide credentials file."))
                    return False

            # Initialize Firebase app
            if project_id:
                self.project_id = project_id
                initialize_app(cred, {'projectId': project_id})
            else:
                initialize_app(cred)

            # Get Firestore client
            self.db = firestore.client()
            self.initialized = True

            print(_("Firebase initialized successfully"))
            return True

        except Exception as e:
            print(f"Firebase initialization error: {e}")
            return False

    def store_qc_results(self, device_info: Dict[str, Any], test_results: List[Dict[str, Any]]) -> bool:
        """Store Bluetooth QC test results in Firebase"""
        if not self.initialized or not self.db:
            print(_("Firebase not initialized"))
            return False

        try:
            # Create document data
            doc_data = {
                'timestamp': firestore.SERVER_TIMESTAMP,
                'device_info': device_info,
                'test_results': test_results,
                'total_tests': len(test_results),
                'passed_tests': sum(1 for r in test_results if r.get('status') == 'pass'),
                'failed_tests': sum(1 for r in test_results if r.get('status') == 'fail'),
                'session_id': f"qc_{int(time.time())}",
                'device_name': device_info.get('name', 'Unknown'),
                'device_address': device_info.get('address', 'Unknown')
            }

            # Use a timestamp-based document ID for easy sorting
            doc_id = datetime.now(timezone.utc).strftime('%Y-%m-%d_%H-%M-%S-%f')
            doc_ref = self.db.collection('qc_results').document(doc_id)
            doc_ref.set(doc_data)

            print(f"QC results stored with ID: {doc_ref.id}")
            return True

        except Exception as e:
            print(f"Error storing QC results: {e}")
            return False

    def store_flash_log(self, device_info: Dict[str, Any], flash_result: Dict[str, Any]) -> bool:
        """Store flash operation logs in Firebase"""
        if not self.initialized or not self.db:
            print(_("Firebase not initialized"))
            return False

        try:
            # Create document data
            doc_data = {
                'timestamp': firestore.SERVER_TIMESTAMP,
                'device_info': device_info,
                'flash_result': flash_result,
                'operation_type': 'flash',
                'success': flash_result.get('success', False),
                'mode': flash_result.get('mode', 'unknown'),
                'hardware_version': flash_result.get('hardware_version', 'unknown'),
                'duration': flash_result.get('duration', 0),
                'error_message': flash_result.get('error', ''),
                'session_id': f"flash_{int(time.time())}"
            }

            # Use a timestamp-based document ID for easy sorting
            doc_id = datetime.now(timezone.utc).strftime('%Y-%m-%d_%H-%M-%S-%f')
            doc_ref = self.db.collection('flash_logs').document(doc_id)
            doc_ref.set(doc_data)

            print(f"Flash log stored with ID: {doc_ref.id}")
            return True

        except Exception as e:
            print(f"Error storing flash log: {e}")
            return False

    def store_session_log(self, session_logs: List[str]) -> bool:
        """Store a full session log in Firebase."""
        if not self.initialized or not self.db:
            print(_("Firebase not initialized"))
            return False

        try:
            # Join logs into a single string
            log_content = "\n".join(session_logs)

            doc_data = {
                'timestamp': firestore.SERVER_TIMESTAMP,
                'log_content': log_content,
                'session_id': f"session_{int(time.time())}"
            }

            doc_id = datetime.now(timezone.utc).strftime('%Y-%m-%d_%H-%M-%S-%f')
            doc_ref = self.db.collection('logs').document(doc_id)
            doc_ref.set(doc_data)

            print(f"Session log stored with ID: {doc_ref.id}")
            return True

        except Exception as e:
            print(f"Error storing session log: {e}")
            return False

    def store_device_session(self, session_data: Dict[str, Any]) -> bool:
        """Store structured device session data in Firebase device_sessions collection."""
        if not self.initialized or not self.db:
            print(_("Firebase not initialized"))
            return False

        try:
            # Ensure required fields are present
            required_fields = ['toy_id', 'physical_id', 'session_start', 'session_end']
            for field in required_fields:
                if field not in session_data:
                    print(f"Missing required field: {field}")
                    return False

            # Add timestamp and session ID
            doc_data = {
                'timestamp': firestore.SERVER_TIMESTAMP,
                'session_id': f"device_session_{int(time.time())}",
                **session_data
            }

            # Use timestamp-based document ID
            doc_id = datetime.now(timezone.utc).strftime('%Y-%m-%d_%H-%M-%S-%f')
            doc_ref = self.db.collection('device_sessions').document(doc_id)
            doc_ref.set(doc_data)

            print(f"Device session stored with ID: {doc_ref.id}")
            return True

        except Exception as e:
            print(f"Error storing device session: {e}")
            return False

    def get_qc_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get QC test history from Firebase"""
        if not self.initialized or not self.db:
            return []

        try:
            # Get recent QC results
            docs = self.db.collection('qc_results').order_by('timestamp', direction=firestore.Query.DESCENDING).limit(limit).stream()

            results = []
            for doc in docs:
                data = doc.to_dict()
                data['id'] = doc.id
                results.append(data)

            return results

        except Exception as e:
            print(f"Error getting QC history: {e}")
            return []

    def get_flash_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get flash operation history from Firebase"""
        if not self.initialized or not self.db:
            return []

        try:
            # Get recent flash logs
            docs = self.db.collection('flash_logs').order_by('timestamp', direction=firestore.Query.DESCENDING).limit(limit).stream()

            results = []
            for doc in docs:
                data = doc.to_dict()
                data['id'] = doc.id
                results.append(data)

            return results

        except Exception as e:
            print(f"Error getting flash history: {e}")
            return []

    def create_credentials_template(self, project_id: str) -> str:
        """Create a template for Firebase credentials file"""
        template = {
            "type": "service_account",
            "project_id": project_id,
            "private_key_id": "YOUR_PRIVATE_KEY_ID",
            "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n",
            "client_email": "firebase-adminsdk-xxxxx@PROJECT_ID.iam.gserviceaccount.com",
            "client_id": "YOUR_CLIENT_ID",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40PROJECT_ID.iam.gserviceaccount.com"
        }

        return json.dumps(template, indent=2)

    def setup_firebase_project(self, project_id: str) -> bool:
        """Guide user through Firebase project setup"""
        print("\n" + "="*60)
        print(_("🔥 Firebase Setup Guide"))
        print("="*60)
        print(f"\nProject ID: {project_id}")
        print("\n1. Go to Firebase Console: https://console.firebase.google.com/")
        print("2. Create a new project or select existing project")
        print("3. Go to Project Settings > Service Accounts")
        print("4. Click 'Generate new private key'")
        print("5. Download the JSON file")
        print("6. Rename it to 'firebase-credentials.json'")
        print("7. Place it in the production_flasherv1.2 directory")
        print("\nThe credentials file should contain:")
        print("- project_id")
        print("- private_key")
        print("- client_email")
        print("- ... other Firebase service account fields")

        # Create template file
        template_file = "firebase-credentials-template.json"
        try:
            with open(template_file, 'w') as f:
                f.write(self.create_credentials_template(project_id))
            print(f"\n✅ Template credentials file created: {template_file}")
            print("Edit this file with your actual Firebase credentials")
        except Exception as e:
            print(f"❌ Error creating template file: {e}")

        return True

# Global Firebase instance
firebase_db = FirebaseDB()

def get_firebase_db() -> FirebaseDB:
    """Get the global Firebase database instance"""
    return firebase_db

def init_firebase_with_credentials(credentials_path: str = None, project_id: str = None) -> bool:
    """Initialize Firebase with credentials"""
    return firebase_db.initialize(credentials_path, project_id)

def store_qc_results(device_info: Dict[str, Any], test_results: List[Dict[str, Any]]) -> bool:
    """Store QC results in Firebase"""
    return firebase_db.store_qc_results(device_info, test_results)

def store_flash_log(device_info: Dict[str, Any], flash_result: Dict[str, Any]) -> bool:
    """Store flash log in Firebase"""
    return firebase_db.store_flash_log(device_info, flash_result)

def store_session_log(session_logs: List[str]) -> bool:
    """Store session log in Firebase"""
    return firebase_db.store_session_log(session_logs)

def store_device_session(session_data: Dict[str, Any]) -> bool:
    """Store structured device session data in Firebase"""
    return firebase_db.store_device_session(session_data)

if __name__ == "__main__":
    # Command line interface for Firebase setup
    import sys

    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "setup":
            project_id = sys.argv[2] if len(sys.argv) > 2 else "dinocore-production"
            firebase_db.setup_firebase_project(project_id)

        elif command == "init":
            credentials_path = sys.argv[2] if len(sys.argv) > 2 else None
            project_id = sys.argv[3] if len(sys.argv) > 3 else None

            if firebase_db.initialize(credentials_path, project_id):
                print("✅ Firebase initialized successfully")

                # Test connection
                try:
                    # Try to access Firestore
                    test_ref = firebase_db.db.collection('test').document('connection_test')
                    test_ref.set({'test': True, 'timestamp': firestore.SERVER_TIMESTAMP})
                    print("✅ Firestore connection verified")
                except Exception as e:
                    print(f"❌ Firestore connection failed: {e}")
            else:
                print("❌ Firebase initialization failed")

        elif command == "test":
            if not firebase_db.initialized:
                print("❌ Firebase not initialized. Run 'python firebase_db.py init' first")
                sys.exit(1)

            # Test data
            test_device = {
                'name': 'Test Device',
                'address': 'AA:BB:CC:DD:EE:FF'
            }

            test_results = [
                {
                    'name': 'Mic L/R Balance',
                    'status': 'pass',
                    'details': 'L: 5000 RMS, R: 4950 RMS'
                }
            ]

            if firebase_db.store_qc_results(test_device, test_results):
                print("✅ Test QC results stored successfully")
            else:
                print("❌ Failed to store test QC results")

        elif command == "init_and_test":
            print("--- Initializing and Testing Firebase ---")
            if firebase_db.initialize():
                print("✅ Firebase initialized successfully.")
                # Test data
                test_device = {
                    'name': 'Test Device',
                    'address': 'AA:BB:CC:DD:EE:FF'
                }
                test_results = [
                    {
                        'name': 'Mic L/R Balance',
                        'status': 'pass',
                        'details': 'L: 5000 RMS, R: 4950 RMS'
                    }
                ]
                if firebase_db.store_qc_results(test_device, test_results):
                    print("✅ Test QC results stored successfully in Firebase.")
                else:
                    print("❌ Failed to store test QC results.")
            else:
                print("❌ Firebase initialization failed.")

        else:
            print("Usage: python firebase_db.py [setup|init|test|init_and_test] [args...]")
            print("  setup <project_id>  - Setup Firebase project")
            print("  init <cred_path> <project_id>  - Initialize Firebase")
            print("  test                - Test Firebase connection")
            print("  init_and_test       - Initialize and send a test log")

    else:
        print("DinoCore Firebase Database Module")
        print("Usage: python firebase_db.py [setup|init|test] [args...]")
        print("")
        print("Commands:")
        print("  setup <project_id>  - Guide Firebase project setup")
        print("  init <cred_path> <project_id>  - Initialize with credentials")
        print("  test                - Test Firebase connection")
        print("")
        print(f"Firebase available: {FIREBASE_AVAILABLE}")
        if not FIREBASE_AVAILABLE:
            print("To enable Firebase: pip install firebase-admin")
