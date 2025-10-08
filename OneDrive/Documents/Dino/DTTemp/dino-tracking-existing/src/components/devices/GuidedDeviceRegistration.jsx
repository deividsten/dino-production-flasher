
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, CheckCircle, AlertTriangle, Loader2, Play, Pause, Battery, Volume2, Mic, Headphones, ArrowRight, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Device } from '@/api/entities';
import { useWarehouse } from "@/components/WarehouseProvider";

// --- Placeholder for useLanguage and getCurrentOperator for a runnable file ---
// In a real application, these would be imported from a separate utility or context file.
const useLanguage = () => ({
    t: (key) => {
        const translations = {
            'missing_required_fields': 'Faltan campos obligatorios',
            'unknown': 'desconocido',
            'device_registered_successfully': 'Dispositivo registrado exitosamente', // Added for the outline's alert
        };
        return translations[key] || key;
    }
});

const getCurrentOperator = () => {
    // This is a mock function. In a real application, this would fetch the current user/operator.
    // e.g., from an authentication context or local storage.
    return { name: 'Default Operator' }; // Replace with actual operator name in production
};
// --- End of placeholders ---

export default function GuidedDeviceRegistration({ versions, onRegistrationComplete }) { // Changed onClose to onRegistrationComplete
    const { t } = useLanguage();
    const { activeWarehouse } = useWarehouse();

    // Device registration data
    const [deviceData, setDeviceData] = useState({
        device_id: '',
        version_id: '',
        notes: ''
    });

    // QC Flow states
    const [currentStep, setCurrentStep] = useState('device_info'); // device_info, qc_preparation, qc_testing, qc_results, save_device
    const [isConnecting, setIsConnecting] = useState(false);
    const [qcResults, setQcResults] = useState([]);
    const [currentTestIndex, setCurrentTestIndex] = useState(0);
    const [testInProgress, setTestInProgress] = useState(false);
    const [awaitingUserAction, setAwaitingUserAction] = useState(false);
    const [userActionMessage, setUserActionMessage] = useState('');
    const [logs, setLogs] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false); // New state for submission loading

    // Bluetooth refs
    const bluetoothDevice = useRef(null);
    const logCharacteristic = useRef(null);
    const commandCharacteristic = useRef(null);
    const testTimeoutRef = useRef(null);

    // Bluetooth constants
    const QA_SERVICE_UUID = 'a07498ca-ad5b-474e-940d-16f1fbe7e8cd';
    const QA_CONTROL_UUID = 'b30ac6b4-1b2d-4c2f-9c10-4b2a7b80f1a1';
    const QA_EVENTS_UUID = 'f29f4a3e-9a53-4d93-9b33-0a1cc4f0c8a2';

    const tests = [
        {
            name: "Test Audio",
            command: "qa_audio_play",
            payload: { file: 'boot.wav' },
            timeout: 8000,
            icon: Volume2,
            color: "text-blue-600",
            instructions: "Se reproducirá un sonido de prueba. Escucha atentamente para verificar que el audio funciona correctamente.",
            preSteps: []
        },
        {
            name: "Test Mic Básico",
            command: "qa_mic_sensitivity_test",
            payload: { record_ms: 3000 },
            timeout: 6000,
            icon: Mic,
            color: "text-green-600",
            instructions: "Habla cerca del micrófono durante 3 segundos para probar la sensibilidad.",
            preSteps: ["Asegúrate de estar en un ambiente silencioso", "Coloca el dispositivo a unos 20cm de tu boca"]
        },
        {
            name: "Test Mic L/R Balance",
            command: "qa_mic_lr_test",
            payload: { wait_ms: 2000, tone_ms: 2000, volume_percent: 95, freq_hz: 1000 },
            timeout: 10000,
            icon: Headphones,
            color: "text-purple-600",
            instructions: "Se reproducirá un tono y se grabará para verificar el balance izquierdo/derecho.",
            preSteps: ["Mantén el dispositivo en posición horizontal", "No muevas el dispositivo durante la prueba"]
        },
        {
            name: "Test Batería",
            command: "qa_battery_test",
            payload: {},
            timeout: 8000,
            icon: Battery,
            color: "text-orange-600",
            instructions: "Se medirá el voltaje de la batería. IMPORTANTE: Durante esta prueba deberás desconectar y reconectar el cable de la batería cuando se te indique.",
            preSteps: [
                "Localiza el cable de conexión de la batería",
                "Ten listos los dedos para desconectar rápidamente",
                "NO desconectes hasta que aparezca la instrucción específica"
            ],
            requiresUserAction: true
        },
        {
            name: "Ajuste Volumen",
            command: "qa_volume_set",
            payload: { percent: 80 },
            timeout: 3000,
            icon: Volume2,
            color: "text-indigo-600",
            instructions: "Se ajustará el volumen al 80% y se reproducirá un sonido de confirmación.",
            preSteps: []
        }
    ];

    const addLog = useCallback((type, message) => {
        setLogs(prev => [...prev, { type, message, time: new Date().toLocaleTimeString() }]);
    }, []);

    const currentTest = tests[currentTestIndex];

    const handleTestResult = useCallback((testName, status, details) => {
        if (testTimeoutRef.current) {
            clearTimeout(testTimeoutRef.current);
            testTimeoutRef.current = null; // Clear ref after timeout
        }

        setAwaitingUserAction(false);
        setUserActionMessage('');
        setTestInProgress(false);

        const result = {
            name: testName,
            status: status,
            details: details,
            timestamp: new Date().toISOString()
        };

        setQcResults(prev => {
            const newResults = [...prev];
            const existingIndex = newResults.findIndex(r => r.name === testName);
            if (existingIndex !== -1) {
                newResults[existingIndex] = result;
            } else {
                newResults.push(result);
            }
            return newResults;
        });

        addLog(status === 'pass' ? 'success' : 'error', `${testName}: ${status.toUpperCase()}`);

        // Move to next test after a delay
        setTimeout(() => {
            if (currentTestIndex < tests.length - 1) {
                setCurrentTestIndex(prev => prev + 1);
            } else {
                // All tests completed
                setCurrentStep('qc_results');
            }
        }, 1500);
    }, [addLog, currentTestIndex, tests.length, setCurrentStep, setCurrentTestIndex, setAwaitingUserAction, setTestInProgress, setUserActionMessage]);

    // Handle reset of all states
    const handleReset = useCallback(() => {
        setDeviceData({
            device_id: '',
            version_id: '',
            notes: ''
        });
        setCurrentStep('device_info');
        setIsConnecting(false);
        setQcResults([]);
        setCurrentTestIndex(0);
        setTestInProgress(false);
        setAwaitingUserAction(false);
        setUserActionMessage('');
        setLogs([]);
        if (bluetoothDevice.current) {
            bluetoothDevice.current.gatt?.disconnect();
            bluetoothDevice.current = null;
        }
        logCharacteristic.current = null;
        commandCharacteristic.current = null;
        if (testTimeoutRef.current) {
            clearTimeout(testTimeoutRef.current);
            testTimeoutRef.current = null;
        }
    }, []);


    // Bluetooth connection logic
    const connectToDevice = async () => {
        if (!navigator.bluetooth) {
            addLog('error', 'Web Bluetooth API no está disponible en este navegador.');
            return false;
        }

        setIsConnecting(true);
        addLog('info', 'Iniciando conexión Bluetooth...');

        try {
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ services: [QA_SERVICE_UUID] }],
                optionalServices: [QA_SERVICE_UUID]
            });

            bluetoothDevice.current = device;
            addLog('success', `Dispositivo encontrado: ${device.name || 'ESP32-QA'}`);

            device.addEventListener('gattserverdisconnected', () => {
                addLog('info', 'Dispositivo desconectado');
            });

            const server = await device.gatt.connect();
            const qaService = await server.getPrimaryService(QA_SERVICE_UUID);
            
            logCharacteristic.current = await qaService.getCharacteristic(QA_EVENTS_UUID);
            commandCharacteristic.current = await qaService.getCharacteristic(QA_CONTROL_UUID);

            await logCharacteristic.current.startNotifications();
            logCharacteristic.current.addEventListener('characteristicvaluechanged', handleNotifications);

            addLog('success', 'Conexión establecida exitosamente');
            return true;
        } catch (error) {
            addLog('error', `Error de conexión: ${error.message}`);
            return false;
        } finally {
            setIsConnecting(false);
        }
    };

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
            // Handle plain text responses
            if (message.includes('PASS') || message.includes('FAIL')) {
                const testName = currentTest?.name;
                if (testName) {
                    const status = message.includes('PASS') ? 'pass' : 'fail';
                    handleTestResult(testName, status, message);
                }
            }
            
            // Handle battery test specific messages
            if (message.includes('Desconecta la batería') || message.includes('disconnect battery')) {
                setAwaitingUserAction(true);
                setUserActionMessage('🔋 DESCONECTA el cable de la batería AHORA');
            } else if (message.includes('Conecta la batería') || message.includes('connect battery')) {
                setAwaitingUserAction(true);
                setUserActionMessage('🔋 CONECTA el cable de la batería AHORA');
            }
        }
    }, [addLog, currentTest, handleTestResult, setAwaitingUserAction, setUserActionMessage]);

    const startCurrentTest = async () => {
        if (!currentTest) return;

        setTestInProgress(true);
        addLog('info', `Iniciando ${currentTest.name}...`);

        const commandData = {
            id: Date.now().toString(),
            type: currentTest.command,
            payload: currentTest.payload
        };

        const sent = await sendCommand(JSON.stringify(commandData));
        
        if (sent) {
            // Set timeout for this test
            testTimeoutRef.current = setTimeout(() => {
                addLog('error', `Test ${currentTest.name}: TIMEOUT`);
                handleTestResult(currentTest.name, 'fail', 'Timeout - No response received');
            }, currentTest.timeout);
        } else {
            handleTestResult(currentTest.name, 'fail', 'Failed to send command');
        }
    };

    const handleUserActionComplete = () => {
        setAwaitingUserAction(false);
        setUserActionMessage('');
        // Continue with the test - the device will send the result when ready
    };

    const saveDevice = async () => {
        if (!activeWarehouse) { // Added check for activeWarehouse
            alert('Por favor selecciona un warehouse antes de registrar un dispositivo');
            return;
        }

        if (!deviceData.device_id || !deviceData.version_id) {
            alert('Por favor completa todos los campos requeridos'); // Updated alert message
            return;
        }

        setIsSubmitting(true);
        const currentOperator = getCurrentOperator();

        try {
            let componentsUsed = [];
            if (deviceData.version_id && versions) {
                const selectedVersion = versions.find(v => v.id === deviceData.version_id);
                if (selectedVersion && selectedVersion.components_used) {
                    componentsUsed = selectedVersion.components_used;
                }
            }

            const deviceToSave = {
                warehouse_id: activeWarehouse.id,
                device_id: deviceData.device_id,
                version_id: deviceData.version_id,
                components_used: componentsUsed,
                status: qcResults.every(r => r.status === 'pass') ? 'ready' : 'defective',
                assembly_date: new Date().toISOString(),
                assembled_by_operator: currentOperator?.name || t('unknown'),
                notes: deviceData.notes,
                qc_results: qcResults
            };

            await Device.create(deviceToSave);
            
            alert(t('device_registered_successfully') + ' ' + deviceData.device_id); // Added success alert
            addLog('success', `Dispositivo ${deviceData.device_id} registrado exitosamente`);
            onRegistrationComplete?.(); // Changed onSuccess to onRegistrationComplete
            handleReset(); // Reset states after successful save
        } catch (error) {
            console.error('Error registering device:', error);
            alert(`Error: ${error.message}`);
            addLog('error', `Error al guardar dispositivo: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 'device_info':
                return (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Información del Dispositivo</h2>
                            <p className="text-slate-600">Ingresa los datos básicos del dispositivo a registrar</p>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="device_id">ID del Dispositivo*</Label>
                                <Input
                                    id="device_id"
                                    value={deviceData.device_id}
                                    onChange={(e) => setDeviceData(prev => ({...prev, device_id: e.target.value}))}
                                    placeholder="Escanear o ingresar ID..."
                                    className="font-mono text-lg"
                                />
                            </div>
                            
                            <div>
                                <Label htmlFor="version_id">Versión del Dinosaurio*</Label>
                                <Select 
                                    value={deviceData.version_id} 
                                    onValueChange={(value) => setDeviceData(prev => ({...prev, version_id: value}))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar versión..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {versions?.map(v => (
                                            <SelectItem key={v.id} value={v.id}>{v.model_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div>
                                <Label htmlFor="notes">Notas (Opcional)</Label>
                                <Textarea
                                    id="notes"
                                    value={deviceData.notes}
                                    onChange={(e) => setDeviceData(prev => ({...prev, notes: e.target.value}))}
                                    placeholder="Observaciones de ensamblaje..."
                                />
                            </div>
                        </div>
                        
                        <Button
                            onClick={() => setCurrentStep('qc_preparation')}
                            disabled={!deviceData.device_id || !deviceData.version_id}
                            className="w-full h-12 text-lg bg-gradient-to-r from-blue-600 to-indigo-600"
                        >
                            Continuar al Control de Calidad
                            <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                    </div>
                );

            case 'qc_preparation':
                return (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Preparación para Control de Calidad</h2>
                            <p className="text-slate-600">Conecta el dispositivo y prepárate para las pruebas</p>
                        </div>
                        
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <Info className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-semibold text-amber-800 mb-2">Instrucciones de Preparación:</h3>
                                    <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                                        <li>Enciende el dispositivo ESP32</li>
                                        <li>Asegúrate de que el dispositivo esté en modo QA</li>
                                        <li>Ten el cable de la batería accesible (lo necesitarás durante las pruebas)</li>
                                        <li>Colócate en un ambiente silencioso para las pruebas de audio</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        
                        <Button
                            onClick={async () => {
                                const connected = await connectToDevice();
                                if (connected) {
                                    setCurrentStep('qc_testing');
                                    setCurrentTestIndex(0);
                                }
                            }}
                            disabled={isConnecting}
                            className="w-full h-12 text-lg bg-gradient-to-r from-green-600 to-emerald-600"
                        >
                            {isConnecting ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    Conectando...
                                </>
                            ) : (
                                <>
                                    Conectar y Comenzar Pruebas
                                    <Play className="w-5 h-5 ml-2" />
                                </>
                            )}
                        </Button>
                    </div>
                );

            case 'qc_testing':
                const TestIcon = currentTest?.icon || AlertTriangle;
                return (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">
                                Ejecutando Pruebas de QC
                            </h2>
                            <p className="text-slate-600">
                                Prueba {currentTestIndex + 1} de {tests.length}
                            </p>
                            
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                                <div 
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${((currentTestIndex) / tests.length) * 100}%` }}
                                />
                            </div>
                        </div>
                        
                        {currentTest && (
                            <Card className="bg-white border-2 border-blue-200">
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-3">
                                        <TestIcon className={`w-6 h-6 ${currentTest.color}`} />
                                        {currentTest.name}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-slate-700 mb-4">{currentTest.instructions}</p>
                                    
                                    {currentTest.preSteps && currentTest.preSteps.length > 0 && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                            <h4 className="font-semibold text-blue-800 text-sm mb-2">Pasos previos:</h4>
                                            <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                                                {currentTest.preSteps.map((step, idx) => (
                                                    <li key={idx}>{step}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    
                                    {awaitingUserAction && (
                                        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-4">
                                            <div className="text-center">
                                                <h3 className="font-bold text-red-800 text-lg mb-2">¡ACCIÓN REQUERIDA!</h3>
                                                <p className="text-red-700 text-xl font-semibold mb-4">{userActionMessage}</p>
                                                <Button 
                                                    onClick={handleUserActionComplete}
                                                    className="bg-red-600 hover:bg-red-700"
                                                >
                                                    ✅ Acción Completada
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {!testInProgress && !awaitingUserAction && (
                                        <Button
                                            onClick={startCurrentTest}
                                            className="w-full h-12 text-lg bg-gradient-to-r from-green-600 to-emerald-600"
                                        >
                                            <Play className="w-5 h-5 mr-2" />
                                            Iniciar {currentTest.name}
                                        </Button>
                                    )}
                                    
                                    {testInProgress && !awaitingUserAction && (
                                        <div className="text-center py-4">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
                                            <p className="text-slate-600">Ejecutando {currentTest.name}...</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                        
                        {qcResults.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="font-semibold text-slate-700">Resultados de Pruebas:</h3>
                                {qcResults.map((result, idx) => (
                                    <div key={idx} className={`flex items-center justify-between p-2 rounded-lg border ${
                                        result.status === 'pass' 
                                            ? 'bg-green-50 border-green-200 text-green-800'
                                            : 'bg-red-50 border-red-200 text-red-800'
                                    }`}>
                                        <span className="font-medium">{result.name}</span>
                                        <Badge variant={result.status === 'pass' ? 'default' : 'destructive'}>
                                            {result.status === 'pass' ? '✓ PASS' : '✗ FAIL'}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );

            case 'qc_results':
                const passedTests = qcResults.filter(r => r.status === 'pass').length;
                const totalTests = qcResults.length;
                const allPassed = passedTests === totalTests;
                
                return (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Resultados del Control de Calidad</h2>
                            <p className="text-slate-600">Todas las pruebas han sido completadas</p>
                        </div>
                        
                        <div className={`p-6 rounded-lg border-2 ${
                            allPassed 
                                ? 'bg-green-50 border-green-300' 
                                : 'bg-red-50 border-red-300'
                        }`}>
                            <div className="text-center mb-4">
                                {allPassed ? (
                                    <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-2" />
                                ) : (
                                    <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-2" />
                                )}
                                <h3 className={`text-2xl font-bold ${allPassed ? 'text-green-800' : 'text-red-800'}`}>
                                    {allPassed ? '✅ DISPOSITIVO APROBADO' : '❌ DISPOSITIVO FALLIDO'}
                                </h3>
                                <p className={`text-lg ${allPassed ? 'text-green-700' : 'text-red-700'}`}>
                                    {passedTests} de {totalTests} pruebas exitosas
                                </p>
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                            <h3 className="font-semibold text-slate-700">Detalle de Resultados:</h3>
                            {qcResults.map((result, idx) => (
                                <div key={idx} className={`p-4 rounded-lg border ${
                                    result.status === 'pass' 
                                        ? 'bg-green-50 border-green-200'
                                        : 'bg-red-50 border-red-200'
                                }`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-semibold text-slate-800">{result.name}</h4>
                                        <Badge variant={result.status === 'pass' ? 'default' : 'destructive'}>
                                            {result.status === 'pass' ? '✓ PASS' : '✗ FAIL'}
                                        </Badge>
                                    </div>
                                    {result.details && (
                                        <p className="text-sm text-slate-600">{result.details}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setCurrentStep('qc_testing');
                                    setCurrentTestIndex(0);
                                    setQcResults([]);
                                }}
                                className="h-12"
                                disabled={isSubmitting}
                            >
                                🔄 Repetir Pruebas
                            </Button>
                            
                            <Button
                                onClick={saveDevice}
                                className="h-12 bg-gradient-to-r from-blue-600 to-indigo-600"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Registrando...
                                    </>
                                ) : (
                                    <>
                                        💾 Registrar Dispositivo
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                );

            default:
                return <div>Paso desconocido</div>;
        }
    };

    return (
        <Dialog open={true} onOpenChange={onRegistrationComplete}> {/* Changed onClose to onRegistrationComplete */}
            <DialogContent className="max-w-4xl bg-white p-0 max-h-[90vh] overflow-y-auto">
                <DialogHeader className="p-6 bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
                    <DialogTitle className="text-xl font-bold">
                        Registro Guiado de Dispositivo
                    </DialogTitle>
                    <DialogDescription className="text-blue-100">
                        Proceso completo: Información → Control de Calidad → Registro
                    </DialogDescription>
                    <DialogClose asChild>
                        <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/20">
                            <X className="h-4 w-4" />
                        </Button>
                    </DialogClose>
                </DialogHeader>

                <div className="p-6">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            {renderStepContent()}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Logs Section - Only show during QC */}
                {(currentStep === 'qc_testing' || currentStep === 'qc_results') && logs.length > 0 && (
                    <div className="border-t bg-gray-50 p-4">
                        <h3 className="font-semibold text-gray-700 mb-2">Log de Eventos:</h3>
                        <div className="max-h-40 overflow-y-auto bg-white border rounded p-3 font-mono text-xs space-y-1">
                            {logs.slice(-10).map((log, i) => (
                                <div key={i} className={`${
                                    log.type === 'error' ? 'text-red-600' :
                                    log.type === 'success' ? 'text-green-600' :
                                    'text-blue-600'
                                }`}>
                                    <strong>[{log.time}]</strong> {log.message}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
