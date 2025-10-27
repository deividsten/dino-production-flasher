#!/usr/bin/env python3
"""
DinoCore Production Flasher Auto-Updater
Handles automatic updates from GitHub releases
"""

import os
import sys
import json
import requests
import zipfile
import shutil
import subprocess
import tempfile
from datetime import datetime
from typing import Optional, Dict, Any

class DinoUpdater:
    """Auto-update system for DinoCore Production Flasher"""

    def __init__(self, repo_owner="deivid-commits", repo_name="dino-production-flasher"):
        self.repo_owner = repo_owner
        self.repo_name = repo_name
        self.github_api_url = f"https://api.github.com/repos/{repo_owner}/{repo_name}"
        self.version_file = "version.json"
        self.backup_dir = "backup"
        self.temp_dir = tempfile.gettempdir()
        self.current_dir = os.path.dirname(os.path.abspath(__file__))

        # Ensure backup directory exists
        os.makedirs(self.backup_dir, exist_ok=True)

    def get_current_version(self) -> Optional[str]:
        """Get current version from version.json"""
        try:
            if os.path.exists(self.version_file):
                with open(self.version_file, 'r') as f:
                    data = json.load(f)
                    return data.get('version')
        except Exception as e:
            print(f"❌ Error reading version file: {e}")
        return None

    def set_current_version(self, version: str, metadata: Optional[Dict[str, Any]] = None):
        """Update version.json file"""
        data = {
            "version": version,
            "last_updated": datetime.now().isoformat(),
            "metadata": metadata or {}
        }

        try:
            with open(self.version_file, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"❌ Error writing version file: {e}")
            return False
        return True

    def check_for_updates(self) -> Optional[Dict[str, Any]]:
        """Check GitHub for newer releases"""
        try:
            print("🔍 Checking for updates on GitHub...")

            response = requests.get(f"{self.github_api_url}/releases/latest", timeout=10)
            response.raise_for_status()

            release_data = response.json()
            latest_version = release_data['tag_name'].lstrip('v')
            current_version = self.get_current_version()

            if not current_version:
                print("⚠️  No current version found, update check skipped")
                return None

            if self._is_newer_version(latest_version, current_version):
                print(f"✅ New version available: {latest_version} (current: {current_version})")
                return {
                    'version': latest_version,
                    'release_data': release_data,
                    'changelog': release_data.get('body', ''),
                    'download_url': self._find_zip_asset(release_data)
                }
            else:
                print(f"✅ You're up to date! (version {current_version})")
                return None

        except requests.exceptions.RequestException as e:
            print(f"❌ Network error checking for updates: {e}")
            return None
        except Exception as e:
            print(f"❌ Error checking for updates: {e}")
            return None

    def update(self, auto_confirm: bool = False) -> bool:
        """Perform update if available"""
        update_info = self.check_for_updates()
        if not update_info:
            return True  # No update needed = success

        print(f"\n📦 Update available: {update_info['version']}")
        if update_info['changelog']:
            print("\n📋 Changelog:")
            print(update_info['changelog'][:500] + "..." if len(update_info['changelog']) > 500 else update_info['changelog'])

        if not auto_confirm:
            try:
                response = input("\n🔄 Do you want to install this update? (y/N): ").strip().lower()
                if response not in ['y', 'yes']:
                    print("❌ Update cancelled by user")
                    return False
            except KeyboardInterrupt:
                print("\n❌ Update cancelled by user")
                return False

        if not update_info['download_url']:
            print("❌ No download URL found for update")
            return False

        return self._perform_update(update_info)

    def _perform_update(self, update_info: Dict[str, Any]) -> bool:
        """Execute the actual update process"""
        print(f"\n🔄 Starting update to version {update_info['version']}...")

        # Create backup
        if not self._create_backup(update_info['version']):
            print("❌ Failed to create backup, aborting update")
            return False

        # Download update
        zip_path = self._download_update(update_info['download_url'], update_info['version'])
        if not zip_path:
            print("❌ Failed to download update")
            return False

        # Extract and install
        if not self._extract_and_install(zip_path, update_info['version']):
            print("❌ Failed to extract/install update")
            self._rollback_update()
            return False

        # Update version file
        metadata = {
            'updated_from': self.get_current_version(),
            'updated_at': datetime.now().isoformat(),
            'release_info': {
                'name': update_info['release_data'].get('name', ''),
                'published_at': update_info['release_data'].get('published_at', '')
            }
        }

        if not self.set_current_version(update_info['version'], metadata):
            print("⚠️  Warning: Failed to update version file, but update may still work")

        # Clean up
        try:
            os.remove(zip_path)
        except Exception:
            pass

        print(f"\n✅ Successfully updated to version {update_info['version']}!")
        print("🔄 It's recommended to restart the application")

        return True

    def _create_backup(self, target_version: str) -> bool:
        """Create backup of current installation"""
        try:
            print("💾 Creating backup...")

            # Backup version and important files
            backup_files = [
                self.version_file,
                'requirements.txt',
                'config.ini',
                'README.md'
            ]

            # Also backup Python files (but not temp files)
            for file in os.listdir('.'):
                if file.endswith('.py') and not file.startswith('temp_'):
                    backup_files.append(file)

            # Create backup directory with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_subdir = os.path.join(self.backup_dir, f"backup_v{target_version}_{timestamp}")
            os.makedirs(backup_subdir, exist_ok=True)

            for file in backup_files:
                if os.path.exists(file):
                    shutil.copy2(file, os.path.join(backup_subdir, file))

            print(f"✅ Backup created in: {backup_subdir}")
            return True

        except Exception as e:
            print(f"❌ Failed to create backup: {e}")
            return False

    def _download_update(self, download_url: str, version: str) -> Optional[str]:
        """Download update ZIP file"""
        try:
            print("📥 Downloading update...")

            response = requests.get(download_url, stream=True, timeout=30)
            response.raise_for_status()

            zip_path = os.path.join(self.temp_dir, f"dino_update_v{version}_{datetime.now().strftime('%H%M%S')}.zip")

            with open(zip_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            print(f"✅ Update downloaded to: {zip_path}")
            return zip_path

        except Exception as e:
            print(f"❌ Failed to download update: {e}")
            return None

    def _extract_and_install(self, zip_path: str, version: str) -> bool:
        """Extract and install update files"""
        try:
            print("📂 Extracting update...")

            # Extract to temporary directory
            extract_dir = os.path.join(self.temp_dir, f"dino_extract_v{version}")
            if os.path.exists(extract_dir):
                shutil.rmtree(extract_dir)
            os.makedirs(extract_dir)

            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)

            # Find the main directory (GitHub releases typically have an extra level)
            contents = os.listdir(extract_dir)
            if len(contents) == 1 and os.path.isdir(os.path.join(extract_dir, contents[0])):
                source_dir = os.path.join(extract_dir, contents[0])
            else:
                source_dir = extract_dir

            print("🔄 Installing update files...")

            # Files to update (include ALL logging-critical files)
            # GET ALL FILES FROM RELEASE - not just predefined ones
            update_files = set()

            # Scan all files in the production_flasherv1.2 directory from the release
            for root, dirs, files in os.walk(source_dir):
                for file in files:
                    # Skip certain files/directories
                    if any(skip in os.path.join(root, file) for skip in [
                        '__pycache__', 'temp_ble_test.py', 'ble_connection_test.py',
                        'ble_service_test.py', 'ble_diagnostic_test.py', 'session.log',
                        'firebase-credentials.json', '.git', 'backup', 'testing_firmware'
                    ]):
                        continue

                    # Get relative path from production_flasherv1.2 directory
                    rel_path = os.path.relpath(os.path.join(root, file), source_dir)
                    update_files.add(rel_path)

            print(f"   📂 Found {len(update_files)} files to potentially update")

            # But ensure critical files are prioritized
            critical_files = {
                'production_flasherv1.2/flasher_logger.py',
                'production_flasherv1.2/auto_updater_launcher.py',
                'production_flasherv1.2/start_gui.bat',
                'production_flasherv1.2/start_with_logging.bat',
                'production_flasherv1.2/install_everything.bat',
                'production_flasherv1.2/README_START.md',
                'production_flasherv1.2/debug_firebase_logs.py',
                'production_flasherv1.2/clean_firebase_logs.py',
                'version.json'
            }

            # Add critical files even if not in release (safety)
            update_files.update(critical_files)

            updated_files = []

            for file in update_files:
                src = os.path.join(source_dir, 'production_flasherv1.2', file)
                dst = os.path.join(self.current_dir, file)

                if os.path.exists(src):
                    shutil.copy2(src, dst)
                    updated_files.append(file)
                    print(f"   📄 Updated: {file}")

            # Update main directory files
            for file in ['CHANGELOG.md', 'INSTALL.md']:
                src = os.path.join(source_dir, file)
                dst = os.path.join(os.path.dirname(self.current_dir), file)
                if os.path.exists(src):
                    shutil.copy2(src, dst)
                    updated_files.append(file)
                    print(f"   📄 Updated: {file}")

            # Check if requirements changed and update dependencies
            if 'requirements.txt' in updated_files:
                if self._update_dependencies():
                    print("   📦 Dependencies updated")
                else:
                    print("⚠️  Dependencies update failed, but continuing")

            # Cleanup extraction directory
            try:
                shutil.rmtree(extract_dir)
            except Exception:
                pass

            print(f"✅ Successfully installed {len(updated_files)} updated files")
            return True

        except Exception as e:
            print(f"❌ Failed to extract/install update: {e}")
            return False

    def _update_dependencies(self) -> bool:
        """Update Python dependencies if requirements.txt changed"""
        try:
            print("   🔄 Checking Python dependencies...")

            # First, try to install/upgrade all dependencies
            result = subprocess.run([
                sys.executable, '-m', 'pip', 'install', '-r',
                os.path.join(self.current_dir, 'requirements.txt'),
                '--upgrade', '--quiet'
            ], capture_output=True, text=True, timeout=120)

            if result.returncode != 0:
                print(f"   ⚠️  Initial dependency update failed: {result.stderr}")
                # Try without --quiet to see what's happening
                print("   🔄 Retrying dependency installation with verbose output...")
                result = subprocess.run([
                    sys.executable, '-m', 'pip', 'install', '-r',
                    os.path.join(self.current_dir, 'requirements.txt'),
                    '--upgrade'
                ], capture_output=True, text=True, timeout=120)

            if result.returncode == 0:
                print("   ✅ Dependencies updated successfully")
                return True
            else:
                print(f"   ❌ Dependency update failed: {result.stderr}")
                return False

        except Exception as e:
            print(f"   ⚠️  Failed to update dependencies: {e}")
            return False

    def _rollback_update(self) -> bool:
        """Attempt to rollback to backup"""
        try:
            print("🔄 Attempting rollback to previous version...")

            # Find latest backup
            if not os.path.exists(self.backup_dir):
                print("❌ No backup directory found")
                return False

            backups = [d for d in os.listdir(self.backup_dir)
                      if os.path.isdir(os.path.join(self.backup_dir, d)) and d.startswith('backup_')]

            if not backups:
                print("❌ No backups found")
                return False

            # Get most recent backup
            backups.sort(reverse=True)
            latest_backup = os.path.join(self.backup_dir, backups[0])

            print(f"📂 Restoring from backup: {backups[0]}")

            # Restore files
            for file in os.listdir(latest_backup):
                src = os.path.join(latest_backup, file)
                dst = os.path.join(self.current_dir, file)

                if file == self.version_file:
                    # Skip version file, keep current to avoid version confusion
                    continue

                shutil.copy2(src, dst)
                print(f"   🔄 Restored: {file}")

            print("✅ Rollback completed")
            return True

        except Exception as e:
            print(f"❌ Rollback failed: {e}")
            return False

    def _find_zip_asset(self, release_data: Dict[str, Any]) -> Optional[str]:
        """Find ZIP asset in GitHub release"""
        for asset in release_data.get('assets', []):
            if asset['name'].endswith('.zip'):
                return asset['browser_download_url']
        return None

    def _is_newer_version(self, new_version: str, current_version: str) -> bool:
        """Compare version strings (simplified)"""
        def parse_version(v: str) -> tuple:
            parts = v.split('.')
            return tuple(int(x) for x in parts[:3])  # major.minor.patch

        try:
            new_parsed = parse_version(new_version)
            current_parsed = parse_version(current_version)
            return new_parsed > current_parsed
        except Exception:
            return False


def main():
    """Command-line interface for updater"""
    import argparse

    parser = argparse.ArgumentParser(description="DinoCore Production Flasher Updater")
    parser.add_argument('action', choices=['check', 'update'],
                       help='Action to perform')
    parser.add_argument('--yes', '-y', action='store_true',
                       help='Auto-confirm updates')
    parser.add_argument('--repo', default='deivid-commits/dino-production-flasher',
                       help='GitHub repository (owner/repo)')

    args = parser.parse_args()

    # Parse repo argument
    if '/' in args.repo:
        owner, name = args.repo.split('/', 1)
    else:
        owner = args.repo
        name = 'dino-production-flasher'

    updater = DinoUpdater(owner, name)

    if args.action == 'check':
        update_info = updater.check_for_updates()
        if update_info:
            print("\n🎉 Update available!")
            print(f"   Version: {update_info['version']}")
            if update_info['changelog']:
                print(f"   Details: {update_info['changelog'][:200]}...")
        else:
            print("\n✅ No updates available")

    elif args.action == 'update':
        success = updater.update(auto_confirm=args.yes)
        if success:
            print("\n✅ Update completed successfully!")
            print("Please restart the application to use the new version.")
        else:
            print("\n❌ Update failed or was cancelled")

        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
