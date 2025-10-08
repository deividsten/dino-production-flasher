
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Device, Dinosaur } from "@/api/entities"; // Import Dinosaur
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TestTube, Search, CheckCircle, AlertTriangle, Loader2, Battery, Volume2, Mic, Headphones, Play, Clock, ArrowLeft, Fingerprint, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";
import { sendSlackNotification } from "@/api/functions"; // New import

const deviceIconUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68af5f6ad9b1f7a20934bb86/5428f7869_Dino_Cylinder_Assemblyssss2025-07-07exploted.png';
const dinoIconUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68af5f6ad9b1f7a20934bb86/491c99d45_JBL_Clip_4_kQQvRxv2copia.png';


export default function QualityControlPage() {
    const { t } = useLanguage();
    
    // New state for mode selection
    const [qcMode, setQcMode] = useState(null); // null, 'device', 'dino'

    const [deviceId, setDeviceId] = useState("");
    const [rfid, setRfid] = useState(""); // State for RFID input
    const [currentDevice, setCurrentDevice] = useState(null);
    const [currentDinosaur, setCurrentDinosaur] = useState(null); // State for found dinosaur
    const [isSearching, setIsSearching] = useState(false);
    const [isTestingInProgress, setIsTestingInProgress] = useState(false);

    // QC Test States
    const [logs, setLogs] = useState([]);
    const [testResults, setTestResults] = useState([]);
    const [currentTestIndex, setCurrentTestIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [awaitingUserAction, setAwaitingUserAction] = useState(false);
    const [userActionMessage, setUserActionMessage] = useState('');
    const [testCompleted, setTestCompleted] = useState(false);
    const [isSavingResults, setIsSavingResults] = useState(false);

    // Detailed test summaries
    const [micSummary, setMicSummary] = useState(null);
    const [batterySummary, setBatterySummary] = useState(null);
    const [audioSummary, setAudioSummary] = useState(null);
    const [micLrSummary, setMicLrSummary] = useState(null);
    const [volumeSummary, setVolumeSummary] = useState(null);

    // Bluetooth refs
    const bluetoothDevice = useRef(null);
    const logCharacteristic = useRef(null);
    const commandCharacteristic = useRef(null);
    const testTimeoutRef = useRef(null);
    const currentTestStartTime = useRef(null);

    // Promise tracking for better response handling (e.g., waiting for ACK)
    // Map: commandId -> { testName: string, ackResolve: (result) => void, ackReject: (error) => void }
    const pendingTestAcks = useRef(new Map());
    // Tracks the ID of the command that's currently active and awaiting an ACK or a final result message.
    const currentTestId = useRef(null);

    // Bluetooth constants
    const QA_SERVICE_UUID = 'a07498ca-ad5b-474e-940d-16f1fbe7e8cd';
    const QA_CONTROL_UUID = 'b30ac6b4-1b2d-4c2f-9c10-4b2a7b80f1a1';
    const QA_EVENTS_UUID = 'f29f4a3e-9a53-4d93-9b33-0a1cc4f0c8a2';

    // QC Threshold for microphone tests
    const QC_THRESHOLD = 4500;

    const tests = useMemo(() => [
        {
            name: "Test Mic L/R Balance",
            command: "qa_mic_lr_test",
            payload: { wait_ms: 2000, tone_ms: 2000, volume_percent: 95, freq_hz: 1000 },
            timeout: 10000,
            icon: Headphones,
            color: "text-purple-600",
            description: t('testing_mic_lr_balance')
        }
    ], [t]);

    const addLog = useCallback((type, message, details = null) => {
        const timestamp = new Date().toISOString();
        const logEntry = {
            type,
            message,
            details,
            time: timestamp,
            localTime: new Date().toLocaleTimeString()
        };
        setLogs(prev => [...prev, logEntry]);
        console.log(`[${timestamp}] ${type.toUpperCase()}: ${message}`, details || '');
    }, []);

    const searchDeviceById = async (idToSearch) => {
        setIsSearching(true);
        addLog('info', t('searching_device_by_id', { id: idToSearch }));
        try {
            const devices = await Device.filter({ device_id: idToSearch });
            if (devices.length > 0) {
                setCurrentDevice(devices[0]);
                addLog('success', t('device_found', { deviceId: devices[0].device_id }), { device: devices[0] });
                return devices[0];
            } else {
                addLog('error', t('device_not_found', { id: idToSearch }));
                alert(t('alert_device_not_found', { id: idToSearch }));
                setCurrentDevice(null);
                return null;
            }
        } catch (error) {
            addLog('error', t('error_searching_device', { message: error.message }), error);
            alert(t('alert_error_searching_device'));
            return null;
        } finally {
            setIsSearching(false);
        }
    };

    const searchDevice = async () => {
        if (!deviceId.trim()) {
            alert(t('alert_enter_device_id'));
            return;
        }
        await searchDeviceById(deviceId.trim());
    };
    
    const searchDinosaur = async () => {
        if (!rfid.trim()) {
            alert(t('alert_enter_dino_rfid'));
            return;
        }
        
        setIsSearching(true);
        addLog('info', t('searching_dinosaur_by_rfid', { rfid: rfid.trim() }));
        
        try {
            const dinos = await Dinosaur.filter({ rfid_code: rfid.trim() });
            if (dinos.length > 0) {
                const dinosaur = dinos[0];
                setCurrentDinosaur(dinosaur);
                addLog('success', t('dinosaur_found', { rfidCode: dinosaur.rfid_code }), { dinosaur });

                if (dinosaur.device_id) {
                    addLog('info', t('dinosaur_associated_with_device', { deviceId: dinosaur.device_id }));
                    await searchDeviceById(dinosaur.device_id);
                } else {
                    addLog('error', t('dinosaur_no_device_id'));
                    alert(t('alert_dinosaur_no_device_id'));
                    setCurrentDevice(null);
                }
            } else {
                addLog('error', t('dinosaur_not_found', { rfid: rfid.trim() }));
                alert(t('alert_dinosaur_not_found', { rfid: rfid.trim() }));
                setCurrentDinosaur(null);
                setCurrentDevice(null);
            }
        } catch (error) {
            addLog('error', t('error_searching_dinosaur', { message: error.message }), error);
            alert(t('alert_error_searching_dinosaur'));
        } finally {
            setIsSearching(false);
        }
    };


    const saveTestResults = useCallback(async () => {
        if (!currentDevice || testResults.length === 0) {
            addLog('error', 'No device or test results to save');
            return;
        }

        setIsSavingResults(true);
        addLog('info', 'Saving QC results to database...');

        try {
            const passed = testResults.filter(r => r.status === 'pass').length;
            const total = testResults.length;
            const allPassed = passed === total;
            const newStatus = allPassed ? 'ready' : 'defective';

            // Enhanced QC results with microphone data
            const qcResults = testResults.map(result => {
                const baseResult = {
                    name: result.name,
                    status: result.status,
                    details: result.details || t('no_details_provided'),
                    timestamp: result.timestamp || new Date().toISOString()
                };

                // Add microphone specific data if available
                if (result.name === "Test Mic L/R Balance" && result.evaluation_data) {
                    baseResult.microphone_data = {
                        rms_L: result.evaluation_data.rms_L,
                        rms_R: result.evaluation_data.rms_R,
                        left_passed: result.evaluation_data.left_passed,
                        right_passed: result.evaluation_data.right_passed,
                        threshold: QC_THRESHOLD
                    };

                    // Also include raw baseline data if available
                    if (result.raw_response && result.raw_response.payload && result.raw_response.payload.baseline) {
                        baseResult.baseline_data = result.raw_response.payload.baseline;
                    }
                }

                return baseResult;
            });

            const updateData = {
                qc_results: qcResults,
                last_qc_date: new Date().toISOString(),
                status: newStatus
            };

            addLog('info', t('qc_data_prepared_to_save'), {
                device_id: currentDevice.device_id,
                status: newStatus,
                qc_results: qcResults
            });

            await Device.update(currentDevice.id, updateData);

            addLog('success', `QC results saved successfully. Device status: ${newStatus}`);
            
            // 🧪 Send Slack notification for QC results
            try {
              const emoji = allPassed ? '✅' : '❌';
              const statusText = allPassed ? 'APROBADO' : 'FALLIDO';
              const color = allPassed ? '#10b981' : '#ef4444';

              const testDetails = testResults.map(test => {
                const icon = test.status === 'pass' ? '✅' : '❌';
                return `${icon} *${test.name}*: ${test.status === 'pass' ? 'Aprobado' : 'Fallido'}`;
              }).join('\n');

              await sendSlackNotification({
                blocks: [
                  {
                    type: "header",
                    text: {
                      type: "plain_text",
                      text: `${emoji} Control de Calidad ${statusText}`,
                      emoji: true
                    }
                  },
                  {
                    type: "section",
                    fields: [
                      {
                        type: "mrkdwn",
                        text: `*Device ID:*\n\`${currentDevice.device_id}\``
                      },
                      {
                        type: "mrkdwn",
                        text: `*Estado:*\n${allPassed ? '✅ Listo' : '❌ Defectuoso'}`
                      }
                    ]
                  },
                  {
                    type: "section",
                    fields: [
                      {
                        type: "mrkdwn",
                        text: `*Tests Aprobados:*\n${passed} de ${total}`
                      },
                      {
                        type: "mrkdwn",
                        text: `*Resultado:*\n${allPassed ? 'APROBADO' : 'FALLIDO'}`
                      }
                    ]
                  },
                  {
                    type: "section",
                    text: {
                      type: "mrkdwn",
                      text: `*📋 Detalles de Pruebas:*\n${testDetails}`
                    }
                  },
                  {
                    type: "context",
                    elements: [
                      {
                        type: "mrkdwn",
                        text: `🧪 QC completado | 📅 ${new Date().toLocaleString('es-ES')}`
                      }
                    ]
                  }
                ],
                color: color
              });
              addLog('success', 'Slack notification sent successfully.');
            } catch (slackError) {
              addLog('error', `Error sending QC Slack notification: ${slackError.message}`, slackError);
            }

            // Refresh device data from DB to ensure local state is consistent with the latest DB update
            const updatedDevices = await Device.filter({ device_id: currentDevice.device_id });
            if (updatedDevices.length > 0) {
                setCurrentDevice(updatedDevices[0]);
            }

        } catch (error) {
            addLog('error', `Failed to save QC results: ${error.message}`, error);
            alert('Error al guardar resultados de QC. Ver logs para detalles.');
        } finally {
            setIsSavingResults(false);
        }
    }, [currentDevice, testResults, addLog, QC_THRESHOLD, t]);

    const sendCommand = useCallback(async (command) => {
        if (!commandCharacteristic.current) {
            addLog('error', t('command_characteristic_not_available'));
            return false;
        }

        try {
            const encoder = new TextEncoder();
            await commandCharacteristic.current.writeValue(encoder.encode(command));
            addLog('info', t('command_sent_successfully'), { command });
            return true;
        } catch (error) {
            addLog('error', t('error_sending_command', { message: error.message }), { command, error });
            return false;
        }
    }, [addLog, t]);

    const handleTestResult = useCallback((result) => {
        if (testTimeoutRef.current) {
            clearTimeout(testTimeoutRef.current);
            testTimeoutRef.current = null;
        }

        // Clear current test ID to prevent duplicate processing
        currentTestId.current = null;

        setAwaitingUserAction(false);
        setUserActionMessage('');

        const elapsed = currentTestStartTime.current ? Date.now() - currentTestStartTime.current : 0;
        const enrichedResult = {
            ...result,
            elapsed_ms: elapsed,
            timestamp: result.timestamp || new Date().toISOString()
        };

        setTestResults(prev => {
            const newResults = [...prev];
            const existingIndex = newResults.findIndex(r => r.name === enrichedResult.name);
            if (existingIndex !== -1) {
                newResults[existingIndex] = enrichedResult;
            } else {
                newResults.push(enrichedResult);
            }
            return newResults;
        });

        addLog(
            enrichedResult.status === 'pass' ? 'success' : 'error',
            t('test_completed_status', { name: enrichedResult.name, status: enrichedResult.status.toUpperCase() }),
            {
                status: enrichedResult.status,
                details: enrichedResult.details,
                elapsed_ms: elapsed
            }
        );

        // Update progress
        const completedTests = currentTestIndex + 1;
        setProgress((completedTests / tests.length) * 100);

        // Complete the test sequence
        setTimeout(() => {
            if (currentTestIndex < tests.length - 1) {
                addLog('info', t('advancing_to_next_test', { current: currentTestIndex + 2, total: tests.length }));
                setCurrentTestIndex(prev => prev + 1);
            } else {
                addLog('success', t('all_tests_completed'));
                setTestCompleted(true);
                setIsTestingInProgress(false);
            }
        }, 1500);
    }, [addLog, currentTestIndex, tests, t]);

    const handleTestTimeout = useCallback((testName) => {
        const elapsed = currentTestStartTime.current ? Date.now() - currentTestStartTime.current : 0;
        addLog('error', t('timeout_in_test', { testName: testName }), {
            test_name: testName,
            elapsed_ms: elapsed,
            timeout_reason: t('no_response_within_timeout')
        });

        const result = {
            name: testName,
            status: 'fail',
            details: `${t('timeout_after')} ${elapsed}ms - ${t('no_response_received')}`,
            timestamp: new Date().toISOString(),
            error: t('timeout'),
            elapsed_ms: elapsed
        };
        handleTestResult(result);
    }, [addLog, handleTestResult, t]);

    const handleNotifications = useCallback((event) => {
        const value = event.target.value;
        const decoder = new TextDecoder('utf-8');
        const message = decoder.decode(value);

        addLog('info', t('received_via_ble', { length: message.length }));

        try {
            const data = JSON.parse(message);

            // Handle Mic L/R test specifically
            if (data.kind === 'mic_lr_test') {
                addLog('success', t('processing_mic_lr_response'), {
                    baseline_rms_L: data.payload?.baseline?.rms_L,
                    baseline_rms_R: data.payload?.baseline?.rms_R,
                    tone_rms_L: data.payload?.tone?.rms_L,
                    tone_rms_R: data.payload?.tone?.rms_R
                });

                const payload = data.payload;
                if (payload && payload.tone) {
                    const rmsL = payload.tone.rms_L;
                    const rmsR = payload.tone.rms_R;

                    // Apply specific criteria: >QC_THRESHOLD = PASS, <=QC_THRESHOLD = FAIL
                    const leftPassed = rmsL > QC_THRESHOLD;
                    const rightPassed = rmsR > QC_THRESHOLD;
                    const overallPassed = leftPassed && rightPassed;

                    addLog('info', t('microphone_evaluation'), {
                        canal_izquierdo: `${rmsL.toFixed(1)} RMS - ${leftPassed ? t('pass_status') : t('fail_status')}`,
                        canal_derecho: `${rmsR.toFixed(1)} RMS - ${rightPassed ? t('pass_status') : t('fail_status')}`,
                        umbral: QC_THRESHOLD,
                        resultado_final: overallPassed ? t('pass_status') : t('fail_status')
                    });

                    let details = `${t('channel_l')}: ${rmsL.toFixed(1)} RMS (${leftPassed ? t('pass_status') : t('fail_status')}), ` +
                                 `${t('channel_r')}: ${rmsR.toFixed(1)} RMS (${rightPassed ? t('pass_status') : t('fail_status')}) ` +
                                 `[${t('threshold')}: >${QC_THRESHOLD}]`;

                    if (!overallPassed) {
                        const failedChannels = [];
                        if (!leftPassed) failedChannels.push(`${t('left_channel')} (${rmsL.toFixed(1)})`);
                        if (!rightPassed) failedChannels.push(`${t('right_channel')} (${rmsR.toFixed(1)})`);
                        details += ` - ${t('failed_channels')}: ${failedChannels.join(', ')}`;
                    }

                    // Store detailed summary for later use
                    setMicLrSummary({
                        pass: overallPassed,
                        baseline: payload.baseline,
                        tone: payload.tone,
                        detect: payload.detect,
                        evaluation: {
                            rms_L: rmsL,
                            rms_R: rmsR,
                            left_passed: leftPassed,
                            right_passed: rightPassed,
                            threshold: QC_THRESHOLD
                        }
                    });

                    // Process the test result - this will end the current test
                    handleTestResult({
                        name: "Test Mic L/R Balance",
                        status: overallPassed ? 'pass' : 'fail',
                        details: details,
                        raw_response: data,
                        evaluation_data: {
                            rms_L: rmsL,
                            rms_R: rmsR,
                            left_passed: leftPassed,
                            right_passed: rightPassed
                        }
                    });

                    return;
                } else {
                    addLog('error', t('mic_lr_test_no_valid_tone_data'), data);
                    handleTestResult({
                        name: "Test Mic L/R Balance",
                        status: 'fail',
                        details: t('error_no_valid_tone_data'),
                        raw_response: data
                    });
                    return;
                }
            }
            // Keeping existing summary and instruction handlers as they provide auxiliary data
            // and don't conflict with the 'mic_lr_test' handling.
            else if (data.type === 'qa_mic_summary') {
                setMicSummary(data);
                addLog('info', t('mic_summary_received'), data);
            } else if (data.type === 'qa_battery_summary') {
                setBatterySummary(data);
                addLog('info', t('battery_summary_received'), data);
            } else if (data.type === 'qa_audio_summary') {
                setAudioSummary(data);
                addLog('info', t('audio_summary_received'), data);
            } else if (data.type === 'qa_volume_summary') {
                setVolumeSummary(data);
                addLog('info', t('volume_summary_received'), data);
            } else if (data.type === 'qa_instruction') {
                if (data.wait_for_user) {
                    setAwaitingUserAction(true);
                    setUserActionMessage(data.instruction);
                    addLog('warning', t('user_instruction_required'), data);
                } else {
                    addLog('info', t('instruction_received'), data);
                }
            }
            // Handle other test responses
            else {
                addLog('info', t('json_message', { kind: data.kind || t('unknown_type') }), data);
            }

        } catch (e) {
            addLog('warning', t('text_message', { message: message }), { parse_error: e.message });

            // KEEPING existing plain text handlers
            if (message.includes('PASS') || message.includes('FAIL')) {
                const testName = tests[currentTestIndex]?.name;
                if (testName) {
                    const status = message.includes('PASS') ? 'pass' : 'fail';
                    addLog('success', t('identified_text_result', { status: status }), { test_name: testName, message });
                    handleTestResult({
                        name: testName,
                        status: status,
                        details: message,
                        raw_response: message
                    });
                } else {
                    addLog('warning', t('pass_fail_no_active_test'), { message });
                }
            }

            // Handle battery test specific messages
            if (message.includes('Desconecta la batería') || message.includes('disconnect battery')) {
                setAwaitingUserAction(true);
                setUserActionMessage(t('disconnect_battery_cable'));
                addLog('warning', t('user_action_disconnect_battery'), { message });
            } else if (message.includes('Conecta la batería') || message.includes('connect battery')) {
                setAwaitingUserAction(true);
                setUserActionMessage(t('connect_battery_cable'));
                addLog('warning', t('user_action_connect_battery'), { message });
            }
        }
    }, [currentTestIndex, tests, handleTestResult, addLog, QC_THRESHOLD, t]);

    const runNextTest = useCallback(async (testIndex = currentTestIndex) => {
        // Prevent duplicate test execution
        if (currentTestId.current) {
            addLog('warning', t('test_already_running'));
            return;
        }

        const test = tests[testIndex];
        if (!test) {
            addLog('warning', t('test_not_found_at_index', { index: testIndex }));
            return;
        }

        currentTestStartTime.current = Date.now();
        const commandId = `${test.command}_${Date.now()}`;
        currentTestId.current = commandId;

        addLog('info', t('starting_test', { testName: test.name }), {
            test_index: testIndex,
            command: test.command,
            timeout_ms: test.timeout
        });

        const commandData = {
            id: commandId,
            type: test.command,
            payload: test.payload
        };

        const sent = await sendCommand(JSON.stringify(commandData));

        if (sent) {
            addLog('info', t('command_sent_waiting_response'));

            // Set timeout for this test
            testTimeoutRef.current = setTimeout(() => {
                // Ensure this timeout is for the currently active test
                if (currentTestId.current === commandId) {
                    handleTestTimeout(test.name);
                }
            }, test.timeout);
        } else {
            currentTestId.current = null; // Clear ID on send failure
            handleTestResult({
                name: test.name,
                status: 'fail',
                details: t('error_sending_command_generic'),
                error: 'SEND_FAILED'
            });
        }
    }, [tests, currentTestIndex, sendCommand, handleTestTimeout, handleTestResult, addLog, t]);

    const connectBluetooth = useCallback(async () => {
        addLog('info', t('starting_bluetooth_connection'));

        try {
            // Request Bluetooth device
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ services: [QA_SERVICE_UUID] }],
                optionalServices: [QA_SERVICE_UUID]
            });

            bluetoothDevice.current = device;
            addLog('success', t('device_selected', { name: device.name || device.id }));

            // Connect to device
            const server = await device.gatt.connect();
            addLog('success', t('connected_to_gatt_server'));

            // Get service
            const service = await server.getPrimaryService(QA_SERVICE_UUID);
            addLog('success', t('qa_service_obtained'));

            // Get characteristics
            const [controlChar, eventsChar] = await Promise.all([
                service.getCharacteristic(QA_CONTROL_UUID),
                service.getCharacteristic(QA_EVENTS_UUID)
            ]);

            commandCharacteristic.current = controlChar;
            logCharacteristic.current = eventsChar;

            // Start notifications
            await eventsChar.startNotifications();
            eventsChar.addEventListener('characteristicvaluechanged', handleNotifications);

            addLog('success', t('characteristics_configured_notifications_started'));
            return true;

        } catch (error) {
            addLog('error', t('bluetooth_connection_error', { message: error.message }), error);
            return false;
        }
    }, [addLog, handleNotifications, t]);

    const startQCTests = useCallback(async () => {
        if (!currentDevice) {
            addLog('error', t('no_device_selected'));
            return;
        }

        addLog('info', t('starting_qc_tests_sequence'));

        // Reset test state
        setTestResults([]);
        setTestCompleted(false);
        setProgress(0);
        setCurrentTestIndex(0);
        setAwaitingUserAction(false);
        setUserActionMessage('');
        setIsSavingResults(false);

        // Clear summaries
        setMicSummary(null);
        setBatterySummary(null);
        setAudioSummary(null);
        setMicLrSummary(null);
        setVolumeSummary(null);

        // Clear any existing timeouts
        if (testTimeoutRef.current) {
            clearTimeout(testTimeoutRef.current);
            testTimeoutRef.current = null;
        }

        // Clear pending promises
        pendingTestAcks.current.clear();
        currentTestId.current = null;

        // Try to connect to Bluetooth device
        const connected = await connectBluetooth();

        if (connected) {
            addLog('success', t('bluetooth_connected_starting_tests'));
            setIsTestingInProgress(true);
            // The useEffect will handle starting the first test
        } else {
            addLog('error', t('bluetooth_connection_failed_tests_cancelled'));
            alert(t('alert_bluetooth_connection_failed'));
        }
    }, [currentDevice, addLog, connectBluetooth, t]);

    const handleUserActionComplete = () => {
        setAwaitingUserAction(false);
        setUserActionMessage('');
        addLog('info', t('user_action_completed_continuing_test'));
    };

    const resetAll = () => {
        addLog('info', t('resetting_qc_state'));

        setQcMode(null); // Return to selection
        setCurrentDevice(null);
        setCurrentDinosaur(null);
        setDeviceId("");
        setRfid("");
        setTestResults([]);
        setLogs([]);
        setTestCompleted(false);
        setIsTestingInProgress(false);
        setProgress(0);
        setCurrentTestIndex(0);
        setIsSavingResults(false);

        // Reset summaries
        setMicSummary(null);
        setBatterySummary(null);
        setAudioSummary(null);
        setMicLrSummary(null);
        setVolumeSummary(null);

        // Clear any active test timeout
        if (testTimeoutRef.current) {
            clearTimeout(testTimeoutRef.current);
            testTimeoutRef.current = null;
        }

        // Clear promises and IDs
        pendingTestAcks.current.clear();
        currentTestId.current = null;

        // Disconnect Bluetooth if connected
        if (bluetoothDevice.current && bluetoothDevice.current.gatt.connected) {
            bluetoothDevice.current.gatt.disconnect();
            addLog('info', t('bluetooth_device_disconnected'));
        }

        if (logCharacteristic.current) {
            logCharacteristic.current.removeEventListener('characteristicvaluechanged', handleNotifications);
        }

        logCharacteristic.current = null;
        commandCharacteristic.current = null;
        bluetoothDevice.current = null;
    };

    // Auto-run next test when index changes
    useEffect(() => {
        if (isTestingInProgress && currentTestIndex >= 0 && currentTestIndex < tests.length) {
            const delay = 1500; // Wait between tests
            const timeoutId = setTimeout(() => {
                runNextTest(currentTestIndex);
            }, delay);

            return () => clearTimeout(timeoutId);
        }
    }, [currentTestIndex, isTestingInProgress, tests.length, runNextTest]);

    const renderSelectionScreen = () => (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center text-slate-700 mb-8">{t('select_qc_type')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card 
                    className="cursor-pointer hover:shadow-2xl hover:scale-105 transition-all duration-300 bg-white/80"
                    onClick={() => setQcMode('device')}
                >
                    <CardHeader className="items-center text-center">
                        <img src={deviceIconUrl} alt="Device Icon" className="w-24 h-24 object-contain mb-4"/>
                        <CardTitle className="text-xl">{t('qc_by_device')}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center text-slate-600">
                        <p>{t('qc_device_description')}</p>
                    </CardContent>
                </Card>
                <Card 
                    className="cursor-pointer hover:shadow-2xl hover:scale-105 transition-all duration-300 bg-white/80"
                    onClick={() => setQcMode('dino')}
                >
                    <CardHeader className="items-center text-center">
                        <img src={dinoIconUrl} alt="Dinosaur Icon" className="w-24 h-24 object-contain mb-4"/>
                        <CardTitle className="text-xl">{t('qc_by_dinosaur')}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center text-slate-600">
                        <p>{t('qc_dinosaur_description')}</p>
                    </CardContent>
                </Card>
            </div>
        </motion.div>
    );

    const renderQCFlow = () => (
        <>
            <Button onClick={resetAll} variant="ghost" className="absolute top-6 left-6 text-slate-600">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('back')}
            </Button>
            
            {/* Search Section */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <TestTube className="w-6 h-6 text-blue-600" />
                            {qcMode === 'device' ? t('select_device_for_qc') : t('select_dinosaur_for_qc')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-4">
                            <div className="flex-1">
                                {qcMode === 'device' ? (
                                    <Input
                                        value={deviceId}
                                        onChange={(e) => setDeviceId(e.target.value)}
                                        placeholder={t('enter_device_id_placeholder')}
                                        className="font-mono text-lg"
                                        onKeyDown={(e) => e.key === 'Enter' && searchDevice()}
                                    />
                                ) : (
                                    <Input
                                        value={rfid}
                                        onChange={(e) => setRfid(e.target.value)}
                                        placeholder={t('scan_or_enter_rfid_placeholder')}
                                        className="font-mono text-lg"
                                        onKeyDown={(e) => e.key === 'Enter' && searchDinosaur()}
                                    />
                                )}
                            </div>
                            <Button
                                onClick={qcMode === 'device' ? searchDevice : searchDinosaur}
                                disabled={isSearching || (qcMode === 'device' ? !deviceId.trim() : !rfid.trim())}
                                className="px-8"
                            >
                                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                {t('search')}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
            
            {/* Dinosaur Info (for dino mode) */}
            <AnimatePresence>
                {qcMode === 'dino' && currentDinosaur && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                        <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
                            <CardHeader><CardTitle>{t('selected_dinosaur')}</CardTitle></CardHeader>
                            <CardContent className="flex gap-4 items-center">
                                <img src={dinoIconUrl} alt="Dino" className="w-16 h-16"/>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                    <p className="text-sm text-slate-500">{t('rfid_label')}</p><p className="font-mono font-semibold">{currentDinosaur.rfid_code}</p>
                                    <p className="text-sm text-slate-500">{t('color_label')}</p><p className="capitalize">{currentDinosaur.color}</p>
                                    <p className="text-sm text-slate-500">{t('status_label')}</p><Badge variant={currentDinosaur.status === 'available' ? 'default' : 'secondary'}>{currentDinosaur.status}</Badge>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Common UI for device info, testing, results, logs */}
            {/* Current Device Info */}
            <AnimatePresence>
                {currentDevice && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
                            <CardHeader>
                                <CardTitle>{t('device_to_test')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-sm text-slate-500">{t('device_id_label')}</p>
                                        <p className="font-mono font-semibold">{currentDevice.device_id}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">{t('current_status_label')}</p>
                                        <Badge variant={currentDevice.status === 'ready' ? 'default' : 'destructive'}>
                                            {currentDevice.status}
                                        </Badge>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">{t('assembled_label')}</p>
                                        <p className="text-sm">{new Date(currentDevice.assembly_date).toLocaleDateString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">{t('last_qc_label')}</p>
                                        <p className="text-sm">
                                            {currentDevice.last_qc_date
                                                ? new Date(currentDevice.last_qc_date).toLocaleDateString()
                                                : t('never_label')
                                            }
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-6">
                                    <Button
                                        onClick={startQCTests}
                                        disabled={isTestingInProgress}
                                        className="w-full h-12 text-lg bg-gradient-to-r from-blue-600 to-indigo-600"
                                    >
                                        {isTestingInProgress ? (
                                            <>
                                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                {t('running_tests')}
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-5 h-5 mr-2" />
                                                {t('start_qc_tests')}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* QC Testing Progress */}
            <AnimatePresence>
                {isTestingInProgress && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
                            <CardHeader>
                                <CardTitle>{t('test_progress')}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600">
                                        {t('test_x_of_y', { current: currentTestIndex + 1, total: tests.length })}
                                    </span>
                                    <span className="text-sm text-slate-600">
                                        {t('completed_percentage', { percentage: Math.round(progress) })}
                                    </span>
                                </div>

                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>

                                {tests[currentTestIndex] && (
                                    <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                                        {React.createElement(tests[currentTestIndex].icon, {
                                            className: `w-6 h-6 ${tests[currentTestIndex].color}`
                                        })}
                                        <div>
                                            <p className="font-semibold">{tests[currentTestIndex].name}</p>
                                            <p className="text-sm text-slate-600">{tests[currentTestIndex].description}</p>
                                        </div>
                                        <div className="ml-auto">
                                            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                                        </div>
                                    </div>
                                )}

                                {/* User Action Required */}
                                {awaitingUserAction && (
                                    <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                                        <div className="text-center">
                                            <h3 className="font-bold text-red-800 text-lg mb-2">{t('action_required')}</h3>
                                            <p className="text-red-700 text-xl font-semibold mb-4">{userActionMessage}</p>
                                            <Button
                                                onClick={handleUserActionComplete}
                                                className="bg-red-600 hover:bg-red-700"
                                            >
                                                ✅ {t('action_completed')}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Test Results */}
            <AnimatePresence>
                {(testResults.length > 0 || testCompleted) && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
                            <CardHeader>
                                <CardTitle>{t('qc_results')}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {testResults.map((result, idx) => (
                                    <div key={idx} className={`flex items-start justify-between p-3 rounded-lg border ${
                                        result.status === 'pass'
                                            ? 'bg-green-50 border-green-200'
                                            : 'bg-red-50 border-red-200'
                                    }`}>
                                        <div className="flex items-center gap-3 flex-1">
                                            {result.status === 'pass' ? (
                                                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                            ) : (
                                                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium">{result.name}</p>
                                                {result.details && (
                                                    <p className="text-xs text-slate-600 break-words">{result.details}</p>
                                                )}
                                                {result.elapsed_ms && (
                                                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                                        <Clock className="w-3 h-3" />
                                                        {result.elapsed_ms}ms
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <Badge variant={result.status === 'pass' ? 'default' : 'destructive'} className="flex-shrink-0">
                                            {result.status === 'pass' ? t('pass_status') : t('fail_status')}
                                        </Badge>
                                    </div>
                                ))}

                                {testCompleted && (
                                    <div className={`mt-6 p-4 rounded-lg text-center border-2 ${
                                        testResults.every(r => r.status === 'pass')
                                            ? 'bg-green-50 border-green-300'
                                            : 'bg-red-50 border-red-300'
                                    }`}>
                                        <h3 className={`text-xl font-bold ${
                                            testResults.every(r => r.status === 'pass')
                                                ? 'text-green-800'
                                                : 'text-red-800'
                                        }`}>
                                            {testResults.every(r => r.status === 'pass')
                                                ? t('device_approved')
                                                : t('device_failed')
                                            }
                                        </h3>
                                        <p className="text-sm mt-2">
                                            {t('tests_approved', { 
                                                passed: testResults.filter(r => r.status === 'pass').length, 
                                                total: testResults.length 
                                            })}
                                        </p>

                                        <Button
                                            onClick={saveTestResults}
                                            disabled={isSavingResults}
                                            className="mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                                        >
                                            {isSavingResults ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                    {t('saving')}
                                                </>
                                            ) : (
                                                t('continue_save_results')
                                            )}
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Logs Section */}
            <AnimatePresence>
                {logs.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
                            <CardHeader>
                                <CardTitle>{t('full_event_log')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="max-h-96 overflow-y-auto bg-gray-50 border rounded p-3 font-mono text-xs space-y-1">
                                    {logs.map((log, i) => (
                                        <div key={i} className={`p-2 rounded border-l-4 ${
                                            log.type === 'error' ? 'bg-red-50 border-red-500 text-red-700' :
                                            log.type === 'success' ? 'bg-green-50 border-green-500 text-green-700' :
                                            log.type === 'warning' ? 'bg-yellow-50 border-yellow-500 text-yellow-700' :
                                            'bg-blue-50 border-blue-500 text-blue-700'
                                        }`}>
                                            <div className="flex justify-between items-start">
                                                <strong className="text-xs">[{log.localTime}]</strong>
                                                <span className={`text-xs px-1 rounded uppercase ${
                                                    log.type === 'error' ? 'bg-red-200 text-red-800' :
                                                    log.type === 'success' ? 'bg-green-200 text-green-800' :
                                                    log.type === 'warning' ? 'bg-yellow-200 text-yellow-800' :
                                                    'bg-blue-200 text-blue-800'
                                                }`}>{log.type}</span>
                                            </div>
                                            <div className="mt-1">{log.message}</div>
                                            {log.details && (
                                                <details className="mt-1 text-xs opacity-75">
                                                    <summary className="cursor-pointer">{t('view_details')}</summary>
                                                    <pre className="mt-1 whitespace-pre-wrap text-xs bg-white p-2 rounded border max-h-40 overflow-y-auto">
                                                        {typeof log.details === 'object'
                                                            ? JSON.stringify(log.details, null, 2)
                                                            : log.details
                                                        }
                                                    </pre>
                                                </details>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2 text-xs text-slate-500">
                                    {t('showing_all_events', { count: logs.length })}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                        {t('quality_control_station')}
                    </h1>
                    <p className="text-slate-600">
                        {t('test_device_quality')}
                    </p>
                </motion.div>

                {qcMode === null ? renderSelectionScreen() : renderQCFlow()}

            </div>
        </div>
    );
}
