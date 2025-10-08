
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DeviceQCModal({ onClose }) {
    const [status, setStatus] = useState("Listo para iniciar");
    const [statusClass, setStatusClass] = useState("disconnected");
    const [logs, setLogs] = useState([]);
    const [currentScreen, setCurrentScreen] = useState("start");
    const [deviceInfo, setDeviceInfo] = useState(null);
    const [testResults, setTestResults] = useState([]);
    const [progress, setProgress] = useState(0);
    const [currentTestName, setCurrentTestName] = useState("Preparando tests...");
    const [overallResult, setOverallResult] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);

    const bluetoothDevice = useRef(null);
    const logCharacteristic = useRef(null);
    const commandCharacteristic = useRef(null);
    const currentTestIndex = useRef(0);
    const testTimeoutRef = useRef(null);

    // ✅ CONSTANTES BLE CORREGIDAS - UUIDs del firmware ESP32
    const QA_SERVICE_UUID = 'a07498ca-ad5b-474e-940d-16f1fbe7e8cd';
    const QA_CONTROL_UUID = 'b30ac6b4-1b2d-4c2f-9c10-4b2a7b80f1a1';
    const QA_EVENTS_UUID = 'f29f4a3e-9a53-4d93-9b33-0a1cc4f0c8a2';

    // ✅ CONSTANTES ADICIONALES PARA COMPATIBILIDAD
    const LOG_CHARACTERISTIC_UUID = QA_EVENTS_UUID;      // Para recibir logs/eventos
    const COMMAND_CHARACTERISTIC_UUID = QA_CONTROL_UUID; // Para enviar comandos

    const tests = [
        { name: "Test Audio", command: "qa_audio_play", payload: { file: 'boot.wav' }, timeout: 8000 },
        { name: "Test Mic Básico", command: "qa_mic_sensitivity_test", payload: { record_ms: 3000 }, timeout: 6000 },
        { name: "Test Mic L/R Balance", command: "qa_mic_lr_test", payload: { wait_ms: 2000, tone_ms: 2000, volume_percent: 95, freq_hz: 1000 }, timeout: 10000 },
        { name: "Test Batería", command: "qa_battery_test", payload: {}, timeout: 5000 },
        { name: "Ajuste Volumen", command: "qa_volume_set", payload: { percent: 80 }, timeout: 3000 }
    ];

    const addLog = useCallback((type, message) => {
        setLogs(prev => [...prev, { type, message, time: new Date().toLocaleTimeString() }]);
    }, []);

    const showScreen = (screen) => setCurrentScreen(screen);

    const disconnect = useCallback(() => {
        if (testTimeoutRef.current) {
            clearTimeout(testTimeoutRef.current);
        }
        if (bluetoothDevice.current && bluetoothDevice.current.gatt.connected) {
            addLog('info', 'Desconectando del dispositivo...');
            bluetoothDevice.current.gatt.disconnect();
        }
        bluetoothDevice.current = null;
        logCharacteristic.current = null;
        commandCharacteristic.current = null;
        setDeviceInfo(null);
        setStatus("Desconectado");
        setStatusClass("disconnected");
    }, [addLog]);

    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    const sendCommand = async (command) => {
        if (!commandCharacteristic.current) {
            addLog('error', 'Error: Característica de comando no disponible.');
            return false;
        }
        try {
            const encoder = new TextEncoder();
            await commandCharacteristic.current.writeValue(encoder.encode(command));
            addLog('info', `Comando enviado: ${command}`);
            return true;
        } catch (error) {
            addLog('error', `Error al enviar comando: ${error.message}`);
            return false;
        }
    };

    const handleTestResult = (testName, status, details) => {
        if (testTimeoutRef.current) {
            clearTimeout(testTimeoutRef.current);
        }

        addLog(status === 'pass' ? 'success' : 'error', `Test ${testName}: ${status.toUpperCase()}`);
        
        setTestResults(prev => {
            const newResults = [...prev];
            const index = newResults.findIndex(r => r.name === testName);
            if (index !== -1) {
                newResults[index] = { name: testName, status, details };
            } else {
                // If testName was not initially added with 'running' status, add it now.
                // This can happen if the first response is directly a PASS/FAIL for an uninitialized test.
                newResults.push({ name: testName, status, details });
            }
            return newResults;
        });

        // Update progress
        // Only update progress based on the index of tests array, not number of results
        const completedTests = currentTestIndex.current + 1;
        setProgress((completedTests / tests.length) * 100);

        // Move to next test after a short delay
        setTimeout(() => {
            currentTestIndex.current++;
            runNextTest();
        }, 1000);
    };

    const handleNotifications = useCallback((event) => {
        const value = event.target.value;
        const decoder = new TextDecoder('utf-8');
        const message = decoder.decode(value);
        addLog('info', `Recibido: ${message}`);

        try {
            const data = JSON.parse(message);
            if (data.type === 'test_result') {
                handleTestResult(data.test, data.status, data.details);
            }
        } catch (e) {
            // Not JSON, handle as plain text
            if (message.includes('PASS') || message.includes('FAIL')) {
                const testName = tests[currentTestIndex.current]?.name;
                if (testName) {
                    const status = message.includes('PASS') ? 'pass' : 'fail';
                    handleTestResult(testName, status, message);
                }
            }
        }
    }, [addLog, tests]); // Added 'tests' to the dependency array

    const handleTestTimeout = () => {
        const testName = tests[currentTestIndex.current]?.name;
        addLog('error', `Test ${testName}: TIMEOUT - No se recibió respuesta`);
        handleTestResult(testName, 'fail', 'Timeout - No response received');
    };

    const startNotifications = async () => {
        if (!logCharacteristic.current) {
            addLog('error', 'Error: Característica de log no disponible.');
            return;
        }
        try {
            await logCharacteristic.current.startNotifications();
            logCharacteristic.current.addEventListener('characteristicvaluechanged', handleNotifications);
            addLog('success', 'Notificaciones iniciadas.');
        } catch (error) {
            addLog('error', `Error al iniciar notificaciones: ${error.message}`);
        }
    };

    const connect = async () => {
        if (!navigator.bluetooth) {
            addLog('error', 'Web Bluetooth API no está disponible en este navegador.');
            return false;
        }

        setIsConnecting(true);
        setStatus("Buscando dispositivos ESP32 con firmware QA...");
        setStatusClass("scanning");

        try {
            addLog('info', 'Iniciando búsqueda de dispositivos QA...');

            // ✅ FILTROS CORREGIDOS - Solo el servicio QA que existe
            const device = await navigator.bluetooth.requestDevice({
                filters: [{
                    services: [QA_SERVICE_UUID]  // ← Solo este servicio existe
                }],
                optionalServices: [QA_SERVICE_UUID]  // ← Sin servicios adicionales
            });

            bluetoothDevice.current = device;
            setDeviceInfo({ name: device.name || 'ESP32-QA', id: device.id });
            addLog('success', `Dispositivo QA encontrado: ${device.name || 'ESP32-QA'}`);
            addLog('info', `ID del dispositivo: ${device.id}`);
            setStatus("Conectando al dispositivo QA...");

            // Configurar listener para desconexión
            device.addEventListener('gattserverdisconnected', disconnect);

            // Conectar al servidor GATT
            addLog('info', 'Conectando al servidor GATT...');
            const server = await device.gatt.connect();

            // Obtener el servicio QA
            addLog('info', `Obteniendo servicio QA: ${QA_SERVICE_UUID}`);
            const qaService = await server.getPrimaryService(QA_SERVICE_UUID);

            // ✅ OBTENER CARACTERÍSTICAS CON NOMBRES CORRECTOS
            addLog('info', 'Obteniendo características de comunicación...');
            logCharacteristic.current = await qaService.getCharacteristic(LOG_CHARACTERISTIC_UUID);
            commandCharacteristic.current = await qaService.getCharacteristic(COMMAND_CHARACTERISTIC_UUID);

            setStatus("Conectado al dispositivo QA");
            setStatusClass("connected");
            addLog('success', `Conectado exitosamente a ${device.name || 'ESP32-QA'}`);
            addLog('success', 'Características de comunicación configuradas');

            await startNotifications();
            return true;

        } catch (error) {
            let errorMessage = `Error de conexión: ${error.message}`;

            // Mensajes de error más específicos
            if (error.message.includes('User cancelled')) {
                errorMessage = 'Búsqueda cancelada por el usuario';
            } else if (error.message.includes('No device selected')) {
                errorMessage = 'No se seleccionó ningún dispositivo';
            } else if (error.message.includes('Bluetooth adapter not available')) {
                errorMessage = 'Adaptador Bluetooth no disponible';
            } else if (error.message.includes('Permission denied')) {
                errorMessage = 'Permisos de Bluetooth denegados';
            } else if (error.message.includes('Service not found') || error.message.includes('Failed to read a characteristic')) {
                errorMessage = 'No se encontraron dispositivos con firmware QA válido. Asegúrate de que el dispositivo esté encendido y dentro del rango.';
            }

            addLog('error', errorMessage);
            disconnect();
            return false;
        } finally {
            setIsConnecting(false);
        }
    };

    const runNextTest = async () => {
        if (currentTestIndex.current >= tests.length) {
            // All tests completed
            finalizeTests();
            return;
        }

        const test = tests[currentTestIndex.current];
        setCurrentTestName(`Ejecutando: ${test.name}`);
        addLog('info', `Iniciando ${test.name}...`);

        // Add test to results with "running" status if not already present
        setTestResults(prev => {
            const newResults = [...prev];
            const existingIndex = newResults.findIndex(r => r.name === test.name);
            if (existingIndex === -1) {
                newResults.push({ name: test.name, status: 'running' });
            } else {
                newResults[existingIndex].status = 'running';
            }
            return newResults;
        });

        // Prepare command
        const commandData = {
            id: Date.now().toString(),
            type: test.command,
            payload: test.payload
        };

        // Send command
        const sent = await sendCommand(JSON.stringify(commandData));
        
        if (sent) {
            // Set timeout for this test
            testTimeoutRef.current = setTimeout(handleTestTimeout, test.timeout);
        } else {
            // Failed to send command
            handleTestResult(test.name, 'fail', 'Failed to send command');
        }
    };

    const finalizeTests = () => {
        setCurrentTestName("Tests completados");
        
        const passedTests = testResults.filter(r => r.status === 'pass').length;
        const totalTests = tests.length;
        const allPassed = passedTests === totalTests;
        
        setOverallResult(allPassed ? 'pass' : 'fail');
        addLog(allPassed ? 'success' : 'error', 
              `Tests finalizados: ${passedTests}/${totalTests} aprobados`);
        
        showScreen('results');
    };

    const startQA = async () => {
        resetState();
        showScreen('progress');
        const connected = await connect();
        if (connected) {
            // Wait a moment for connection to stabilize, then start tests
            setTimeout(() => {
                currentTestIndex.current = 0;
                runNextTest();
            }, 1000);
        } else {
            showScreen('start'); // Go back to start if connection failed
        }
    };

    const resetState = () => {
        setLogs([]);
        setTestResults([]);
        setProgress(0);
        setCurrentTestName("Preparando tests...");
        setOverallResult(null);
        currentTestIndex.current = 0;
        if (testTimeoutRef.current) {
            clearTimeout(testTimeoutRef.current);
        }
    };

    const renderScreen = () => {
        switch (currentScreen) {
            case 'progress':
                return (
                    <div className="section">
                        <h2>⚙️ Ejecutando Tests Automáticos</h2>
                        <div id="currentTest">{currentTestName}</div>
                        <div className="progress-bar">
                            <div id="progressFill" className="progress-fill" style={{ width: `${progress}%` }}></div>
                        </div>
                        <div className="text-sm text-slate-600 mt-2">
                            Test {Math.min(currentTestIndex.current + 1, tests.length)} de {tests.length}
                        </div>
                    </div>
                );
            case 'results':
                return (
                    <div className="section">
                        <h2>📊 Resultados Finales de QA</h2>
                        {testResults.map((result, i) => (
                            <div key={i} className={`test-result ${result.status}`}>
                                <h4>
                                    {result.status === 'pass' ? (
                                        <CheckCircle className="text-green-500" />
                                    ) : result.status === 'fail' ? (
                                        <AlertTriangle className="text-red-500" />
                                    ) : (
                                        <Loader2 className="animate-spin text-blue-500" />
                                    )}
                                    {result.name}
                                </h4>
                                {result.details && <div className="details">{result.details}</div>}
                            </div>
                        ))}
                        <div className="summary">
                            <h3>Resumen General</h3>
                            <p>
                                Tests completados: {testResults.filter(r => r.status !== 'running').length} de {tests.length}
                            </p>
                            <p>
                                Estado Final: <span id="overallStatus" className={overallResult}>
                                    {overallResult === 'pass' ? 'APROBADO' : 'FALLIDO'}
                                </span>
                            </p>
                            <Button onClick={() => { resetState(); showScreen('start'); disconnect(); }}>
                                Probar Otro Dispositivo
                            </Button>
                        </div>
                    </div>
                );
            case 'start':
            default:
                return (
                    <div className="section">
                        <h2>🚀 Control de Calidad ESP32</h2>
                        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-800">
                                <strong>Filtro activo:</strong> Solo se mostrarán dispositivos ESP32 con firmware QA válido
                                (UUID: <code className="font-mono text-xs">{QA_SERVICE_UUID}</code>)
                            </p>
                        </div>
                        <p className="mb-4">Este script ejecutará automáticamente todos los tests de QA en el dispositivo ESP32 encontrado.</p>
                        <Button onClick={startQA} disabled={isConnecting} className="success w-full h-14 text-lg">
                           {isConnecting ? <Loader2 className="animate-spin mr-2"/> : '🔍'}
                           {isConnecting ? 'Buscando dispositivos QA...' : 'Buscar y Probar Dispositivo ESP32'}
                        </Button>
                    </div>
                );
        }
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl bg-white p-0">
                <style>{`
                    .container { background: white; border-radius: 10px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .status { text-align: center; font-size: 16px; font-weight: bold; padding: 8px; border-radius: 5px; margin: 10px 0; }
                    .status.disconnected { background: #ffebee; color: #c62828; }
                    .status.connected { background: #e8f5e9; color: #2e7d32; }
                    .status.scanning { background: #fff3e0; color: #ef6c00; }
                    button.success { background: #4CAF50; color: white; }
                    button.success:hover { background: #388E3C; }
                    .section { margin: 20px 0; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; }
                    .section h2 { margin-top: 0; color: #555; border-bottom: 2px solid #2196F3; padding-bottom: 10px; }
                    #log { border: 1px solid #ddd; border-radius: 5px; height: 250px; overflow-y: auto; padding: 10px; background: #fafafa; font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.4; }
                    .log-entry { margin: 5px 0; padding: 5px; border-radius: 3px; word-break: break-all; }
                    .log-entry.error { background: #ffebee; color: #c62828; }
                    .log-entry.success { background: #e8f5e9; color: #2e7d32; }
                    .log-entry.info { background: #e3f2fd; color: #1565c0; }
                    .device-info { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; }
                    .progress-bar { width: 100%; height: 20px; background: #e0e0e0; border-radius: 10px; overflow: hidden; margin: 10px 0; }
                    .progress-fill { height: 100%; background: linear-gradient(90deg, #4CAF50, #2196F3); width: 0%; transition: width 0.3s ease; }
                    .test-result { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 10px 0; }
                    .test-result.pass { border-color: #4CAF50; background: #e8f5e9; }
                    .test-result.fail { border-color: #f44336; background: #ffebee; }
                    .test-result.running { border-color: #2196F3; background: #e3f2fd; }
                    .test-result h4 { margin: 0 0 10px 0; display: flex; align-items: center; gap: 10px; }
                    .test-result .details { font-size: 14px; color: #666; margin-top: 10px; }
                    .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 20px; border: 2px solid #2196F3; }
                    .summary h3 { margin-top: 0; color: #2196F3; }
                    #overallStatus.pass { color: #4CAF50; font-weight: bold; }
                    #overallStatus.fail { color: #f44336; font-weight: bold; }
                `}</style>
                <DialogHeader className="p-6 bg-slate-50">
                    <DialogTitle className="text-xl font-bold text-slate-800">🔬 ESP32 QA Automation Script</DialogTitle>
                    <DialogDescription>
                        Requiere Chrome/Edge y acceso via localhost o HTTPS.
                        Filtro QA activo: solo dispositivos con firmware válido.
                    </DialogDescription>
                    <DialogClose asChild>
                        <Button variant="ghost" size="icon" className="absolute top-4 right-4 rounded-full h-8 w-8">
                            <X className="h-4 w-4" />
                        </Button>
                    </DialogClose>
                </DialogHeader>

                <div className="p-6 max-h-[80vh] overflow-y-auto">
                    <div id="status" className={`status ${statusClass}`}>Estado: {status}</div>

                    {deviceInfo && (
                        <div className="device-info">
                            <p><strong>Dispositivo:</strong> {deviceInfo.name}</p>
                            <p><strong>ID:</strong> {deviceInfo.id}</p>
                        </div>
                    )}

                    <AnimatePresence mode="wait">
                       <motion.div
                         key={currentScreen}
                         initial={{ opacity: 0, y: 20 }}
                         animate={{ opacity: 1, y: 0 }}
                         exit={{ opacity: 0, y: -20 }}
                         transition={{ duration: 0.2 }}
                       >
                         {renderScreen()}
                       </motion.div>
                    </AnimatePresence>

                    <div className="section">
                        <h2>📜 Log de Eventos</h2>
                        <div id="log">
                            {logs.map((log, i) => (
                                <div key={i} className={`log-entry ${log.type}`}>
                                    <strong>[{log.time}]</strong> {log.message}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
