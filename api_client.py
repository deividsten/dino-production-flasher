#!/usr/bin/env python3
"""
DinoCore Production Flasher - API Client Module
Handles communication with external APIs for inventory updates
"""

import os
import json
import requests
import time
from typing import Dict, Any, Optional, Tuple
import configparser

class InventoryAPIClient:
    """Client for DinoCore inventory API and Bondu API"""

    def __init__(self, config_file: str = "config.ini"):
        self.config_file = config_file
        self.base_url = self._load_config()
        self.session = requests.Session()
        self.session.timeout = 10  # 10 second timeout

    def _load_config(self) -> str:
        """Load API configuration from config file"""
        config = configparser.ConfigParser()
        if os.path.exists(self.config_file):
            config.read(self.config_file)
            if 'API' in config and 'base_url' in config['API']:
                return config['API']['base_url'].rstrip('/')
        return "http://localhost:5000"  # Default test URL

    def update_inventory(self, toy_id: str, mac_address: str, test_data: Dict[str, Any]) -> bool:
        """
        Update inventory with toy manufacturing data

        Args:
            toy_id: The toy identifier (e.g., "DINO-001")
            mac_address: MAC address in hex format (e.g., "aabbccddeeff")
            test_data: Dictionary containing logs and/or QC results

        Returns:
            bool: True if successful, False otherwise
        """
        url = f"{self.base_url}/toys/inventory/update"

        # Correct payload structure as required by API
        payload = {
            "toy_id": toy_id,
            "mac_address": mac_address,
            "sku": "",  # Adding required empty SKU
            "test_data": test_data  # Contains logs and any other test data
        }

        try:
            print(f"📡 API CALL: Sending inventory update")
            print(f"📡 URL: {url}")
            print(f"📦 PAYLOAD: {json.dumps(payload, indent=2)}")

            response = self.session.post(url, json=payload, timeout=10)

            print(f"📡 RESPONSE STATUS: {response.status_code}")

            if response.status_code == 200:
                try:
                    response_data = response.json()
                    print(f"📡 RESPONSE SUCCESS: {json.dumps(response_data, indent=2)}")
                    return True
                except json.JSONDecodeError:
                    print(f"📡 RESPONSE TEXT: {response.text}")
                    return True
            else:
                print(f"❌ API ERROR: {response.status_code} - {response.text}")
                return False

        except requests.exceptions.RequestException as e:
            print(f"❌ NETWORK ERROR: {e}")
            return False
        except Exception as e:
            print(f"❌ UNEXPECTED ERROR: {e}")
            return False

    def send_to_bondu_api(self, toy_id: str, mac_address: str, test_data: Dict[str, Any]) -> Tuple[bool, str, str]:
        """
        Send toy data to Bondu API endpoint at https://api.bondu.com/api/partner/toys/inventory/update

        Args:
            toy_id: The toy identifier (e.g., "toy_wrek2b" from Bondu URLs)
            mac_address: MAC address in hex format (e.g., "8cbfea8443c2")
            test_data: Dictionary containing logs and/or QC results

        Returns:
            tuple: (success: bool, error_message: str, full_response: str)
        """
        url = "https://api.bondu.com/api/partner/toys/inventory/update"

        # Prepare payload for Bondu API with exact structure as specified
        payload = {
            "toy_id": toy_id,
            "mac_address": mac_address,
            "sku": "",  # Adding required empty SKU field
            "test_data": test_data
        }

        try:
            print(f"🚀 BONDU API CALL: Sending to {url}")
            print(f"📦 PAYLOAD: {json.dumps(payload, indent=2)}")

            response = self.session.post(
                url,
                json=payload,
                headers={
                    'Content-Type': 'application/json',
                    'Accept': '*/*'
                },
                timeout=15  # 15 second timeout for Bondu API
            )

            print(f"📡 BONDU RESPONSE STATUS: {response.status_code}")
            print(f"📡 BONDU RESPONSE TEXT: {response.text}")

            if response.status_code in [200, 201]:
                print("✅ BONDU API SUCCESS")
                return True, "", response.text
            else:
                error_msg = f"Bondu API returned status {response.status_code}"
                print(f"❌ BONDU API ERROR: {error_msg}")
                return False, error_msg, response.text

        except requests.exceptions.RequestException as e:
            error_msg = f"Bondu API network error: {str(e)}"
            print(f"❌ BONDU NETWORK ERROR: {error_msg}")
            return False, error_msg, str(e)
        except Exception as e:
            error_msg = f"Bondu API unexpected error: {str(e)}"
            print(f"❌ BONDU UNEXPECTED ERROR: {error_msg}")
            return False, error_msg, str(e)

    def test_connection(self) -> bool:
        """Test connection to the main API endpoint"""
        try:
            # Try a simple GET request to check if server is reachable
            response = self.session.get(self.base_url, timeout=5)
            return response.status_code < 500  # Any non-server error is OK for testing
        except:
            return False

# Global API client instance
inventory_api = InventoryAPIClient()

def get_inventory_api() -> InventoryAPIClient:
    """Get the global inventory API client instance"""
    return inventory_api

def update_toy_inventory(toy_id: str, mac_address: str, test_data: Dict[str, Any]) -> Tuple[bool, str, str]:
    """
    Update toy inventory via main API

    Returns:
        tuple: (success: bool, error_message: str, full_response: str)
        - success: True if successful, False otherwise
        - error_message: User-friendly error message
        - full_response: Full response text for debugging
    """
    try:
        success = inventory_api.update_inventory(toy_id, mac_address, test_data)
        if success:
            return True, "", ""
        else:
            return False, "API request failed - check logs for details", ""
    except Exception as e:
        error_msg = f"API connection error: {str(e)}"
        return False, error_msg, str(e)

def send_to_bondu(toy_id: str, mac_address: str, test_data: Dict[str, Any]) -> Tuple[bool, str, str]:
    """
    Send toy data to Bondu API endpoint

    Returns:
        tuple: (success: bool, error_message: str, full_response: str)
        - success: True if successful, False otherwise
        - error_message: User-friendly error message
        - full_response: Full response text for debugging
    """
    return inventory_api.send_to_bondu_api(toy_id, mac_address, test_data)

def test_api_connection() -> bool:
    """Test main API connection"""
    return inventory_api.test_connection()
