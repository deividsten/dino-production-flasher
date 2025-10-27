#!/usr/bin/env python3
"""
DinoCore Production Flasher Internationalization System
Support for English and Chinese languages
"""

import os
import locale
import gettext
from pathlib import Path

class TranslationManager:
    """Manages application translations"""

    def __init__(self, domain='dino_flasher', locale_dir=None):
        self.domain = domain
        self.supported_languages = ['en', 'zh_CN', 'zh_TW']
        self.current_language = 'en'

        # Built-in translations (fallback when .mo files not available)
        self.translations = self.load_builtin_translations()

        # Try to detect system language
        self.detect_system_language()

        # Install translation function
        self.update_translation_function()

    def detect_system_language(self):
        """Detect system language preference"""
        try:
            # Get system locale
            system_locale, encoding = locale.getdefaultlocale()

            if system_locale:
                lang_code = system_locale.split('_')[0]
                if lang_code in ['zh']:
                    # Check if it's Traditional or Simplified
                    if 'TW' in system_locale or 'HK' in system_locale:
                        self.current_language = 'zh_TW'
                    else:
                        self.current_language = 'zh_CN'
                elif lang_code == 'en':
                    self.current_language = 'en'
                else:
                    self.current_language = 'en'  # Default to English
            else:
                self.current_language = 'en'
        except:
            self.current_language = 'en'

    def update_translation_function(self):
        """Update the global _ function"""
        def translation_func(message):
            if self.current_language == 'en':
                return message
            return self.translations.get(self.current_language, {}).get(message, message)

        self._ = translation_func

    def load_builtin_translations(self):
        """Load built-in translations"""
        return {
            'zh_CN': {  # Chinese Simplified
                # Window titles and headers
                "🦕 DinoCore Production Flasher v1.2.0": "🦕 DinoCore 生产闪存器 v1.2.0",
                " ⚙️ Configuration ": " ⚙️ 配置 ",
                " 🎮 Control Panel ": " 🎮 控制面板 ",
                " 📋 Activity Log ": " 📋 活动日志 ",

                # Labels and buttons
                "🎯 Target HW Version:": "🎯 目标硬件版本:",
                "💾 Save Version": "💾 保存版本",
                "▶️  SELECT A MODE": "▶️  选择模式",
                "🏭 PRODUCTION MODE": "🏭 生产模式",
                "🧪 TESTING MODE": "🧪 测试模式",
                "⏹️  STOP & CHANGE MODE": "⏹️  停止并更改模式",

                # Missing button texts (found in UI)
                "🏭 Flash Production": "🏭 烧录生产",
                "🧪 Flash Testing & eFuse": "🧪 烧录测试和 eFuse",

                # Update button text
                "🔄 Check Updates": "🔄 检查更新",

                # Missing status messages
                "🔌 Connect ESP32 Device": "🔌 连接 ESP32 设备",

                # Status messages
                "ACTIVE MODE: PRODUCTION": "激活模式：生产",
                "ACTIVE MODE: TESTING": "激活模式：测试",
                "--- SCANNING STOPPED ---": "--- 扫描停止 ---",
                "Please select a new mode.": "请选择新模式。",

                # Connection status
                "🔗 SERVER ONLINE": "🔗 服务器在线",
                "⚠️ SERVER ISSUES": "⚠️ 服务器问题",
                "❌ OFFLINE": "❌ 离线",

        # Common UI elements
        "Success": "成功",
        "Error": "错误",
        "Warning": "警告",
        "Notice": "注意",

        # New UI strings
        "🆔 Enter Toy ID": "🆔 输入玩具 ID",
        "Scan Toy ID": "扫描玩具 ID",
        "📋 Show Logs": "📋 显示日志",
        "🔗 Connect Dino Device": "🔗 连接 Dino 设备",
                "1. Connect the Dino device to the computer via USB": "1. 通过 USB 将 Dino 设备连接到计算机",
        "2. Place the Dino inside the testing box": "2. 将 Dino 放入测试箱",
        "3. Make sure the device is powered on": "3. 确保设备已开机",
        "4. Wait for the device to be detected": "4. 等待设备被检测到",
        "✅ Device Ready": "✅ 设备就绪",
        "Device Ready": "设备就绪",
        "⏳ Waiting for device...": "⏳ 等待设备...",
        "✅ Device detected and ready!": "✅ 设备检测就绪！",
        "🔵 Ready for Bluetooth QC": "🔵 准备进行蓝牙质量控制",
        "📊 Test Results": "📊 测试结果",
        "⏳ Waiting for test results...": "⏳ 等待测试结果...",
        "🎉 DEVICE APPROVED!": "🎉 设备已批准！",
        "✅ Device passed quality control.\nReady for next device!": "✅ 设备通过质量控制。\n准备下一个设备！",
        "⚠️ DEVICE REQUIRES ATTENTION": "⚠️ 设备需要注意",
        "🔧 Please check the microphones and readjust the plush's felt/fabric:\n\n   1. Open the plush toy carefully\n   2. Check microphone connections\n   3. Ensure microphones are properly positioned\n   4. Re-adjust the felt/fabric padding\n   5. Close the toy and run QC again": "🔧 请检查麦克风并重新调整 plush 的 felt/fabric：\n\n   1. 小心地打开 plush 玩具\n   2. 检查麦克风连接\n   3. 确保麦克风正确定位\n   4. 重新调整 felt/fabric 填充物\n   5. 关闭玩具并再次运行质量控制",
        "🔄 Try Again": "🔄 再试一次",
        "🆕 FLASH NEW DEVICE": "🆕 烧录新设备",
        "Flashing Production...": "正在烧录生产固件...",
        "Flashing Testing...": "正在烧录测试固件...",
        "ESP32 Ready on {}": "ESP32 已在 {} 上就绪",
        "Connect ESP32 Device": "连接 ESP32 设备",
        "Multiple ESP32s Detected": "检测到多个 ESP32",
        "Update cancelled by user": "用户取消了更新",
        "Update completed! Please restart the application.": "更新完成！请重新启动应用程序。",
        "Update completed successfully!\n\nPlease restart the application to use the new version.": "更新成功完成！\n\n请重新启动应用程序以使用新版本。",
        "Update failed. Check the log for details.": "更新失败。请检查日志以获取详细信息。",
        "Bluetooth Not Available": "蓝牙不可用",
        "Bluetooth QC testing is not available on this system.\n\nRequired components:\n• bleak package for Bluetooth LE support\n• Compatible Bluetooth adapter\n• Python asyncio support\n\nPlease install bleak: pip install bleak": "此系统上无法进行蓝牙质量控制测试。\n\n所需组件：\n• 用于蓝牙 LE 支持的 bleak 包\n• 兼容的蓝牙适配器\n• Python asyncio 支持\n\n请安装 bleak：pip install bleak",
        "Bluetooth QC Active...": "蓝牙质量控制激活中...",
        "▶️ SELECT A MODE": "▶️ 选择模式",
        "🔵 BLUETOOTH QC": "🔵 蓝牙质量控制",
        "Scan Result": "扫描结果",
        "No Bluetooth devices found.": "未找到蓝牙设备。",
        "No Bluetooth MAC captured. Please run a 'Testing' flash first.": "未捕获蓝牙 MAC。请先运行 'Testing' 烧录。",
        "Select Bluetooth Device": "选择蓝牙设备",
        "✅ Select Device": "✅ 选择设备",
        "❌ Cancel": "❌ 取消",
        "🦖 DinoCore Production Flasher v1.2.0": "🦖 DinoCore 生产烧录器 v1.2.0",
        "Enter Hardware Version": "输入硬件版本",
        "Please enter the version number printed on the PCB:": "请输入印在 PCB 上的版本号：",
        "OK": "确定",
        "Image pcb_example.png not found or is corrupt.": "未找到图像 pcb_example.png 或图像已损坏。",

        # Bluetooth/Offline functionality
        "Bluetooth library not available": "蓝牙库不可用",
        "Scanning for Bluetooth devices...": "正在扫描蓝牙设备...",
        "Found {} potential QA devices": "找到 {} 个潜在的 QC 设备",
        "Error scanning Bluetooth devices: {}": "扫描蓝牙设备时出错：{}",
        "Connecting to device: {}": "正在连接到设备：{}",
        "Connected to device": "已连接到设备",
        "Failed to connect to device": "连接到设备失败",
        "Connection error: {}": "连接错误：{}",
        "Bluetooth notifications started": "蓝牙通知已启动",
        "Failed to start notifications: {}": "启动通知失败：{}",
        "Received Bluetooth message ({} bytes)": "收到蓝牙消息 ({} 字节)",
        "Error processing Bluetooth message: {}": "处理蓝牙消息时出错：{}",
        "Processing microphone test results": "正在处理麦克风测试结果",
        "Left channel: {:.1f} RMS ({})": "左声道：{:.1f} RMS ({})",
        "Right channel: {:.1f} RMS ({})": "右声道：{:.1f} RMS ({})",
        "Test completed: {}": "测试完成：{}",
        "PASS": "通过",
        "FAIL": "失败",
        "L: {:.1f} RMS, R: {:.1f} RMS [Threshold: >{}]": "左：{:.1f} RMS，右：{:.1f} RMS [阈值：>{}]",
        "User action required: {}": "需要用户操作：{}",
        "Instruction: {}": "指令：{}",
        "Received test result: {}": "收到测试结果：{}",
        "Not connected to device": "未连接到设备",
        "Command sent: {}": "命令已发送：{}",
        "Failed to send command: {}": "发送命令失败：{}",
        "Starting test: {}": "开始测试：{}",
        "Test already running": "测试已在运行",
        "Test not found at index: {}": "在索引 {} 未找到测试",
        "Disconnected from Bluetooth device": "已从蓝牙设备断开",
        "Error disconnecting: {}": "断开连接时出错：{}",
        "Bluetooth library (bleak) not installed": "蓝牙库 (bleak) 未安装",
        "Installing Bluetooth dependencies...": "正在安装蓝牙依赖...",
        "Bluetooth dependencies installed successfully": "蓝牙依赖安装成功",
        "Bluetooth now available": "蓝牙现已可用",
        "Bluetooth installation incomplete - restart required": "蓝牙安装不完整 - 需要重新启动",
        "Failed to install Bluetooth dependencies": "安装蓝牙依赖失败",
        "Error installing Bluetooth: {}": "安装蓝牙时出错：{}",
        "Bluetooth QC tester ready - use bleak library available": "蓝牙 QC 测试仪就绪 - 可以使用 bleak 库",

        # Additional offline/Bluetooth UI
        "OFFLINE MODE": "离线模式",
        "WORKING OFFLINE": "正在离线工作",
        "BLUETOOTH QC": "蓝牙质量控制",
        "CONNECT BLUETOOTH": "连接蓝牙",
        "SCAN DEVICES": "扫描设备",
        "START QC TESTS": "开始 QC 测试",
        "STOP TESTING": "停止测试",
        "TEST RESULTS": "测试结果",
        "QC PASSED": "QC 通过",
        "QC FAILED": "QC 失败",
        "SAVE RESULTS": "保存结果",
        "EXPORT REPORT": "导出报告",
        "BLUETOOTH CONNECTED": "蓝牙已连接",
        "BLUETOOTH DISCONNECTED": "蓝牙已断开",
        "SCANNING...": "扫描中...",
        "NO DEVICES FOUND": "未找到设备",
        "TESTING IN PROGRESS": "测试进行中",
        "TEST COMPLETED": "测试完成",
        "Select QC Mode": "选择 QC 模式",
        "Device QC": "设备 QC",
        "Bluetooth QC": "蓝牙 QC",
        "Test Device Quality via Bluetooth": "通过蓝牙测试设备质量",

                # Update messages
                "✅ You're up to date! (version {version})": "✅ 您已是最新版本！（版本 {version}）",
                "\n📦 Update available: {version}": "\n📦 可用更新：{version}",
                "\n🔄 Starting update to version {version}...": "\n🔄 开始更新到版本 {version}...",
                "\n✅ Successfully updated to version {version}!": "\n✅ 成功更新到版本 {version}！",

                # Validation messages
                "Hardware version saved: {version}": "硬件版本已保存：{version}",
                "Invalid version format. Please use format X.Y.Z (e.g., 1.9.1)": "无效的版本格式。请使用格式 X.Y.Z（例如：1.9.1）",

                # Warnings
                "Production mode will NOT burn eFuses and requires devices to be tested first. Continue?": "生产模式不会烧录 eFuses，需要先测试设备。继续？",
                "Testing mode will attempt to burn HW version {version} to eFuses. This is irreversible. Continue?": "测试模式将尝试将硬件版本 {version} 烧录到 eFuses。这是不可逆转的。继续？",

                # Operation messages (simplified for UI)
                "Using Target HW Version:": "使用目标硬件版本：",
                "Waiting for new devices...": "等待新设备...",
                "[OK] Flash successful!\n": "[成功] 烧录成功！\n",
                "[X] Flash failed with exit code {code}.\n": "[失败] 烧录失败，退出代码 {code}。\n",
            },
            'zh_TW': {  # Chinese Traditional
                # Window titles and headers
                "🦕 DinoCore Production Flasher v1.2.0": "🦕 DinoCore 生產燒錄器 v1.2.0",
                " ⚙️ Configuration ": " ⚙️ 設定 ",
                " 🎮 Control Panel ": " 🎮 控制面板 ",
                " 📋 Activity Log ": " 📋 活動日誌 ",

                # Labels and buttons
                "🎯 Target HW Version:": "🎯 目標硬體版本:",
                "💾 Save Version": "💾 儲存版本",
                "▶️  SELECT A MODE": "▶️  選擇模式",
                "🏭 PRODUCTION MODE": "🏭 生產模式",
                "🧪 TESTING MODE": "🧪 測試模式",
                "⏹️  STOP & CHANGE MODE": "⏹️  停止並更改模式",

                # Missing button texts (found in UI)
                "🏭 Flash Production": "🏭 燒錄生產",
                "🧪 Flash Testing & eFuse": "🧪 燒錄測試和 eFuse",

                # Missing status messages
                "🔌 Connect ESP32 Device": "🔌 連接 ESP32 設備",

                # Update button text
                "� Check Updates": "🔄 檢查更新",

                # Missing Bluetooth QC translation
                "�🔵 BLUETOOTH QC": "🔵 藍牙品質控制",

                # Status messages
                "ACTIVE MODE: PRODUCTION": "啟動模式：生產",
                "ACTIVE MODE: TESTING": "啟動模式：測試",
                "--- SCANNING STOPPED ---": "--- 掃描停止 ---",
                "Please select a new mode.": "請選擇新模式。",

                # Connection status
                "🔗 SERVER ONLINE": "🔗 伺服器線上",
                "⚠️ SERVER ISSUES": "⚠️ 伺服器問題",
                "❌ OFFLINE": "❌ 離線",

                # Common UI elements
                "Success": "成功",
                "Error": "錯誤",
                "Warning": "警告",
                "Notice": "注意",

                # Bluetooth/Offline functionality (Traditional Chinese)
                "Bluetooth library not available": "藍牙程式庫不可用",
                "Scanning for Bluetooth devices...": "正在掃描藍牙裝置...",
                "Found {} potential QA devices": "找到 {} 個潛在的 QC 裝置",
                "Error scanning Bluetooth devices: {}": "掃描藍牙裝置時出錯：{}",
                "Connecting to device: {}": "正在連線到裝置：{}",
                "Connected to device": "已連線到裝置",
                "Failed to connect to device": "連線到裝置失敗",
                "Connection error: {}": "連線錯誤：{}",
                "Bluetooth notifications started": "藍牙通知已啟動",
                "Failed to start notifications: {}": "啟動通知失敗：{}",
                "Received Bluetooth message ({} bytes)": "收到藍牙訊息 ({} 位元組)",
                "Error processing Bluetooth message: {}": "處理藍牙訊息時出錯：{}",
                "Processing microphone test results": "正在處理麥克風測試結果",
                "Left channel: {:.1f} RMS ({})": "左聲道：{:.1f} RMS ({})",
                "Right channel: {:.1f} RMS ({})": "右聲道：{:.1f} RMS ({})",
                "Test completed: {}": "測試完成：{}",
                "PASS": "通過",
                "FAIL": "失敗",
                "L: {:.1f} RMS, R: {:.1f} RMS [Threshold: >{}]": "左：{:.1f} RMS，右：{:.1f} RMS [閾值：>{}]",
                "User action required: {}": "需要使用者操作：{}",
                "Instruction: {}": "指令：{}",
                "Received test result: {}": "收到測試結果：{}",
                "Not connected to device": "未連線到裝置",
                "Command sent: {}": "命令已傳送：{}",
                "Failed to send command: {}": "傳送命令失敗：{}",
                "Starting test: {}": "開始測試：{}",
                "Test already running": "測試已在執行",
                "Test not found at index: {}": "在索引 {} 未找到測試",
                "Disconnected from Bluetooth device": "已從藍牙裝置斷開",
                "Error disconnecting: {}": "斷開連線時出錯：{}",
                "Bluetooth library (bleak) not installed": "藍牙程式庫 (bleak) 未安裝",
                "Installing Bluetooth dependencies...": "正在安裝藍牙相依性...",
                "Bluetooth dependencies installed successfully": "藍牙相依性安裝成功",
                "Bluetooth now available": "藍牙現已可用",
                "Bluetooth installation incomplete - restart required": "藍牙安裝不完整 - 需要重新啟動",
                "Failed to install Bluetooth dependencies": "安裝藍牙相依性失敗",
                "Error installing Bluetooth: {}": "安裝藍牙時出錯：{}",
                "Bluetooth QC tester ready - use bleak library available": "藍牙 QC 測試儀就緒 - 可以使用 bleak 程式庫",

                # Additional offline/Bluetooth UI
                "OFFLINE MODE": "離線模式",
                "WORKING OFFLINE": "正在離線工作",
                "BLUETOOTH QC": "藍牙品質控制",
                "CONNECT BLUETOOTH": "連線藍牙",
                "SCAN DEVICES": "掃描裝置",
                "START QC TESTS": "開始 QC 測試",
                "STOP TESTING": "停止測試",
                "TEST RESULTS": "測試結果",
                "QC PASSED": "QC 通過",
                "QC FAILED": "QC 失敗",
                "SAVE RESULTS": "儲存結果",
                "EXPORT REPORT": "匯出報告",
                "BLUETOOTH CONNECTED": "藍牙已連線",
                "BLUETOOTH DISCONNECTED": "藍牙已斷開",
                "SCANNING...": "掃描中...",
                "NO DEVICES FOUND": "未找到裝置",
                "TESTING IN PROGRESS": "測試進行中",
                "TEST COMPLETED": "測試完成",
                "Select QC Mode": "選擇 QC 模式",
                "Device QC": "裝置 QC",
                "Bluetooth QC": "藍牙 QC",
                "Test Device Quality via Bluetooth": "透過藍牙測試裝置品質",

                # Update messages
                "✅ You're up to date! (version {version})": "✅ 您已是最新版本！（版本 {version}）",
                "\n📦 Update available: {version}": "\n📦 可用更新：{version}",
                "\n🔄 Starting update to version {version}...": "\n🔄 開始更新到版本 {version}...",
                "\n✅ Successfully updated to version {version}!": "\n✅ 成功更新到版本 {version}！",

                # Validation messages
                "Hardware version saved: {version}": "硬體版本已儲存：{version}",
                "Invalid version format. Please use format X.Y.Z (e.g., 1.9.1)": "無效的版本格式。請使用格式 X.Y.Z（例如：1.9.1）",

                # Warnings
                "Production mode will NOT burn eFuses and requires devices to be tested first. Continue?": "生產模式不會燒錄 eFuses，需要先測試設備。繼續？",
                "Testing mode will attempt to burn HW version {version} to eFuses. This is irreversible. Continue?": "測試模式將嘗試將硬體版本 {version} 燒錄到 eFuses。這是不可逆轉的。繼續？",

                # New UI workflow strings (Traditional Chinese)
                "🆔 Enter Toy ID": "🆔 輸入玩具 ID",
                "Scan Toy ID": "掃描玩具 ID",
                "📋 Show Logs": "📋 顯示日誌",
                "🔗 Connect Dino Device": "🔗 連接 Dino 設備",
                "⏳ Waiting for device...": "⏳ 等待設備...",
                "✅ Device detected and ready!": "✅ 設備檢測就緒！",
                "🔵 Ready for Bluetooth QC": "🔵 準備進行藍牙質量控制",
                "📊 Test Results": "📊 測試結果",
                "⏳ Waiting for test results...": "⏳ 等待測試結果...",
                "🎉 DEVICE APPROVED!": "🎉 設備已批准！",
                "✅ Device passed quality control.\nReady for next device!": "✅ 設備通過質量控制。\n準備下一個設備！",
                "⚠️ DEVICE REQUIRES ATTENTION": "⚠️ 設備需要注意",
                "🔧 Please check the microphones and readjust the plush's felt/fabric:\n\n   1. Open the plush toy carefully\n   2. Check microphone connections\n   3. Ensure microphones are properly positioned\n   4. Re-adjust the felt/fabric padding\n   5. Close the toy and run QC again": "🔧 請檢查麥克風並重新調整 plush 的 felt/fabric：\n\n   1. 小心地打開 plush 玩具\n   2. 檢查麥克風連接\n   3. 確保麥克風正確定位\n   4. 重新調整 felt/fabric 填充物\n   5. 關閉玩具並再次運行質量控制",
                "🔄 Try Again": "🔄 再試一次",
                "🆕 FLASH NEW DEVICE": "🆕 燒錄新設備",

                # Operation messages (simplified for UI)
                "Using Target HW Version:": "使用目標硬體版本：",
                "Waiting for new devices...": "等待新設備...",
                "[OK] Flash successful!\n": "[成功] 燒錄成功！\n",
                "[X] Flash failed with exit code {code}.\n": "[失敗] 燒錄失敗，退出程式碼 {code}。\n",
            }
        }

    def set_language(self, language):
        """Change application language"""
        if language in self.supported_languages:
            self.current_language = language
            self.update_translation_function()
            return True
        return False

    def get_current_language(self):
        """Get current language code"""
        return self.current_language

    def get_available_languages(self):
        """Get list of available languages with names"""
        return {
            'en': 'English',
            'zh_CN': '简体中文',
            'zh_TW': '繁體中文'
        }

    def get_language_display_name(self, lang_code):
        """Get display name for language code"""
        names = self.get_available_languages()
        return names.get(lang_code, lang_code)

# Global translation manager instance
translation_manager = TranslationManager()

# Global translation function - updated when language changes
_global_translation_func = None

def _(message):
    """Global translation function"""
    if _global_translation_func is not None:
        return _global_translation_func(message)
    return message  # fallback if not initialized

# Update the global translation function
def _update_global_translation():
    """Update the global translation function reference"""
    global _global_translation_func
    _global_translation_func = translation_manager._

# Override the set_language method to update global function
def set_language_with_global_update(lang_code):
    """Set language and update the global translation function"""
    result = translation_manager.set_language(lang_code)
    if result:
        _update_global_translation()
    return result

# Make the global function available
translation_manager.set_language_global = set_language_with_global_update

def N_(message):
    """Translation function for non-contextual strings"""
    return message

# Translations for static strings (to be extracted)
# Window titles and headers
WINDOW_TITLE = N_("🦕 DinoCore Production Flasher v1.2.0")
CONFIG_SECTION_TITLE = N_(" ⚙️ Configuration ")
CONTROL_PANEL_TITLE = N_(" 🎮 Control Panel ")
ACTIVITY_LOG_TITLE = N_(" 📋 Activity Log ")

# Labels and buttons
TARGET_HW_VERSION_LABEL = N_("🎯 Target HW Version:")
SAVE_VERSION_BUTTON = N_("💾 Save Version")
SELECT_MODE_LABEL = N_("▶️  SELECT A MODE")
PRODUCTION_MODE_BUTTON = N_("🏭 PRODUCTION MODE")
TESTING_MODE_BUTTON = N_("🧪 TESTING MODE")
STOP_BUTTON = N_("⏹️  STOP & CHANGE MODE")

# Status messages
ACTIVATING_PRODUCTION = N_("ACTIVE MODE: PRODUCTION")
ACTIVATING_TESTING = N_("ACTIVE MODE: TESTING")
SCANNING_STOPPED = N_("--- SCANNING STOPPED ---")
SELECT_NEW_MODE = N_("Please select a new mode.")

# Connection status
CONNECTION_ONLINE = N_("🔗 SERVER ONLINE")
CONNECTION_ISSUES = N_("⚠️ SERVER ISSUES")
CONNECTION_OFFLINE = N_("❌ OFFLINE")

# Log messages
USING_HW_VERSION = N_("Using Target HW Version:")
IGNORING_PORTS = N_("Ignoring existing ports:")
WAITING_DEVICES = N_("Waiting for new devices...")
PORTS_DISCONNECTED = N_("Ports disconnected:")

# Firmware operations
DOWNLOADING_FIRMWARE = N_("Downloading {mode} firmware for HW {hardware_version}...")
NO_COMPATIBLE_FIRMWARE = N_("[X] No compatible {mode} firmware found for HW {hardware_version}.")
FOUND_BUILD = N_("Found compatible build: {name}")
DOWNLOADING_FILE = N_("Downloading {filename}...")
DOWNLOAD_SUCCESS = N_("[OK] {mode} firmware for {hardware_version} downloaded successfully.")
NETWORK_ERROR = N_("[X] Network error while downloading: {error}")

# eFuse operations
BURNING_EFUSE = N_("Attempting to burn eFuse with version {version}...")
BURNING_RESET = N_("Attempting to reset device into download mode...")
BURNING_SUCCESS = N_("Device reset successful, proceeding with eFuse burning...")
BURNING_FAIL = N_("Device reset failed, but continuing with eFuse burning...")
BURNING_ERROR = N_("[X] Invalid version format: {version}")
EFUSE_BURN_SUCCESS = N_("[OK] eFuse burned successfully.")
EFUSE_VERIFY_SUCCESS = N_("[OK] Verification successful. Version {version} is burned.")
EFUSE_VERIFY_FAILED = N_("[X] VERIFICATION FAILED. Burned version ({burned}) does not match target ({target}). Stopping.")
EFUSE_BURN_FAILED = N_("Could not burn eFuse. It might be already written.")
EFUSE_BURN_ERROR = N_("eFuse burn error: {error}")

# Reading eFuse
READING_EFUSE = N_("Attempting to read eFuse from {port}...")
EFUSE_READ_FAILED = N_("[X] Failed to read eFuse. Maybe locked?")
FOUND_EFUSE_VERSION = N_("[OK] Found raw eFuse version: {version}")
EFUSE_EMPTY = N_("[!] eFuse block is empty (version 0.0.0). Treating as no version found.")
EFUSE_VERSION_NONE = N_("[!] No version found on eFuse.")

# Flashing operations
FLASHER_UPDATE_AVAILABLE = N_("\n📦 Update available: {version}")
FLASHER_UPDATE_CHANGES = N_("\n📋 Changelog:")
FLASHER_ALL_UP_TO_DATE = N_("✅ You're up to date! (version {version})")
FLASHER_UPDATE_CANCELLED = N_("❌ Update cancelled by user")
FLASHER_NO_DOWNLOAD_URL = N_("❌ No download URL found for update")
FLASHER_STARTING_UPDATE = N_("\n🔄 Starting update to version {version}...")
FLASHER_BACKUP_SUCCESS = N_("✅ Backup created in: {backup_dir}")
FLASHER_BACKUP_FAILED = N_("❌ Failed to create backup: {error}")
FLASHER_DOWNLOADING = N_("📥 Downloading update...")
FLASHER_DOWNLOAD_SUCCESS = N_("✅ Update downloaded to: {zip_path}")
FLASHER_DOWNLOAD_FAILED = N_("❌ Failed to download update: {error}")
FLASHER_EXTRACTING = N_("📂 Extracting update...")
FLASHER_INSTALLING_FILES = N_("🔄 Installing update files...")
FLASHER_FILE_UPDATED = N_("   📄 Updated: {file}")
FLASHER_UPDATE_SUCCESS = N_("\n✅ Successfully updated to version {version}!")
FLASHER_UPDATE_COMPLETE = N_("🔄 It's recommended to restart the application")
FLASHER_UPDATE_FAILED = N_("❌ Failed to extract/install update: {error}")
FLASHER_ROLLBACK = N_("🔄 Attempting rollback to previous version...")
FLASHER_ROLLBACK_FAILED = N_("❌ Rollback failed: {error}")
FLASHER_NO_BACKUP_DIR = N_("❌ No backup directory found")
FLASHER_NO_BACKUPS = N_("❌ No backups found")

# Main flashing process
START_FLASHING = N_("-- Starting {mode} flash for HW {hardware_version} on {port} --")
FLASH_FINISHED = N_("FINISHED FLASHING {port} --")
DOWNLOAD_FAILED_ABORT = N_("[X] Download for {hardware_version} failed. Aborting flash.")
FLASH_SUCCESS = N_("\n[OK] Flash successful!\n")
FLASH_FAILED = N_("\n[X] Flash failed with exit code {code}.\n")
FLASH_UNEXPECTED_ERROR = N_("\n[X] An unexpected error occurred during flash: {error}\n")
FLASH_FINAL_FINISHED = N_("FINISHED FLASHING {port} --")

# Serial monitor
SERIAL_MONITOR_START = N_("--- Serial monitor started for {port} ---")
SERIAL_MONITOR_STOP = N_("--- Serial monitor for {port} stopped. ---")
SERIAL_MONITOR_ERROR = N_("\n[X] Error opening serial monitor on {port}: {error}")
DEVICE_DISCONNECTED_CLOSE = N_("\n--- Device {port} disconnected. Closing monitor. ---")
DEVICE_DISCONNECTED_OPEN = N_("\n--- Device {port} disconnected. Closing monitor. ---")

# Device processing
PROCESSING_NEW_DEVICE = N_("--- Processing new device on {port} ---")
PRODUCTION_MODE_READING = N_("Production mode: Reading eFuse...")
PRODUCTION_FAILED = N_("[X] PRODUCTION FAILED: No eFuse version found. Please run device through Testing Mode first.")
VERSION_FROM_EXISTING = N_("Proceeding with existing version: {version}")
BURN_PENDING_VERIFICATION = N_("Burn command succeeded. Verifying by reading back eFuse...")
BURN_SUCCESS = N_("[OK] Burn command succeeded.")
BURN_FAILED_READ_EXISTING = N_("Burn command failed. Attempting to read existing version...")
BURN_FAILED_NO_VERSION = N_("[X] Could not read existing version after burn failure. Stopping.")

# Thread errors
UNEXPECTED_ERROR = N_("!!!!!!!!!! UNEXPECTED ERROR in device processing thread !!!!!!!!!!!")

# Success confirmation
SUCCESS_DIALOG_TITLE = N_("Success")
SUCCESS_DIALOG_MESSAGE = N_("Hardware version saved: {version}")

# Error dialogs
ERROR_DIALOG_TITLE = N_("Error")
INVALID_VERSION_FORMAT = N_("Invalid version format. Please use format X.Y.Z (e.g., 1.9.1)")
EFUSE_READ_ERROR = N_("[X] Error reading eFuse: {error}")

# Progress indicators
EFUSE_READING_ERROR = N_("[X] Error reading eFuse: {error}")

# Warnings
PRODUCTION_WARNING_TITLE = N_("Warning")
PRODUCTION_WARNING_MESSAGE = N_("Production mode will NOT burn eFuses and requires devices to be tested first. Continue?")
TESTING_NOTICE_TITLE = N_("Notice")
TESTING_NOTICE_MESSAGE = N_("Testing mode will attempt to burn HW version {version} to eFuses. This is irreversible. Continue?")
