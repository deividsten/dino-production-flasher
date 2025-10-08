import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bluetooth, CheckCircle, AlertTriangle, Loader2, Clock } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { cn } from "@/lib/utils";

const LanguageSelector = () => {
  const { language, setLanguage } = useLanguage();

  const languages = [
    { code: 'es', flag: '🇪🇸', name: 'Español' },
    { code: 'en', flag: '🇺🇸', name: 'English' },
    { code: 'zh', flag: '🇨🇳', name: '中文' },
  ];

  return (
    <div className="flex items-center justify-center gap-3 mb-8">
      {languages.map((lang) => (
        <Button
          key={lang.code}
          variant="ghost"
          size="lg"
          className={cn(
            "h-14 px-6 rounded-xl transition-all duration-200 text-lg font-medium",
            language === lang.code 
              ? 'bg-white/20 text-white border-2 border-white/40 scale-110' 
              : 'text-blue-200 hover:text-white hover:bg-white/10 border-2 border-transparent'
          )}
          onClick={() => setLanguage(lang.code)}
        >
          <span className="text-2xl mr-2">{lang.flag}</span>
          {lang.name}
        </Button>
      ))}
    </div>
  );
};

export default function QuickQC() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState([]);
  const [testResults, setTestResults] = useState([]);
  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isTestingInProgress, setIsTestingInProgress] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);

  const bluetoothDevice = useRef(null);
  const logCharacteristic = useRef(null);
  const commandCharacteristic = useRef(null);
  const testTimeoutRef = useRef(null);
  const currentTestStartTime = useRef(null);
  const pendingTestAcks = useRef(new Map());
  const currentTestId = useRef(null);

  const QA_SERVICE_UUID = 'a07498ca-ad5b-474e-940d-16f1fbe7e8cd';
  const QA_CONTROL_UUID = 'b30ac6b4-1b2d-4c2f-9c10-4b2a7b80f1a1';
  const QA_EVENTS_UUID = 'f29f4a3e-9a53-4d93-9b33-0a1cc4f0c8a2';
  const QC_THRESHOLD = 4500;

  const tests = useMemo(() => [
    {
      name: "Test Mic L/R Balance",
      command: "qa_mic_lr_test",
      payload: { wait_ms: 2000, tone_ms: 2000, volume_percent: 95, freq_hz: 1000 },
      timeout: 10000,
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

  const sendCommand = useCallback(async (command) => {
    if (!commandCharacteristic.current) {
      addLog('error', 'Command characteristic not available');
      return false;
    }

    try {
      const encoder = new TextEncoder();
      await commandCharacteristic.current.writeValue(encoder.encode(command));
      addLog('info', 'Command sent successfully', { command });
      return true;
    } catch (error) {
      addLog('error', `Error sending command: ${error.message}`, { command, error });
      return false;
    }
  }, [addLog]);

  const handleTestResult = useCallback((result) => {
    if (testTimeoutRef.current) {
      clearTimeout(testTimeoutRef.current);
      testTimeoutRef.current = null;
    }

    currentTestId.current = null;

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
      `Test completed: ${enrichedResult.name} - ${enrichedResult.status.toUpperCase()}`,
      {
        status: enrichedResult.status,
        details: enrichedResult.details,
        elapsed_ms: elapsed
      }
    );

    const completedTests = currentTestIndex + 1;
    setProgress((completedTests / tests.length) * 100);

    setTimeout(() => {
      if (currentTestIndex < tests.length - 1) {
        addLog('info', `Advancing to next test (${currentTestIndex + 2} of ${tests.length})`);
        setCurrentTestIndex(prev => prev + 1);
      } else {
        addLog('success', 'All tests completed');
        setTestCompleted(true);
        setIsTestingInProgress(false);
      }
    }, 1500);
  }, [addLog, currentTestIndex, tests]);

  const handleTestTimeout = useCallback((testName) => {
    const elapsed = currentTestStartTime.current ? Date.now() - currentTestStartTime.current : 0;
    addLog('error', `Timeout in test: ${testName}`, {
      test_name: testName,
      elapsed_ms: elapsed,
      timeout_reason: 'No response within timeout'
    });

    const result = {
      name: testName,
      status: 'fail',
      details: `Timeout after ${elapsed}ms - No response received`,
      timestamp: new Date().toISOString(),
      error: 'Timeout',
      elapsed_ms: elapsed
    };
    handleTestResult(result);
  }, [addLog, handleTestResult]);

  const handleNotifications = useCallback((event) => {
    const value = event.target.value;
    const decoder = new TextDecoder('utf-8');
    const message = decoder.decode(value);

    addLog('info', `Received via BLE (${message.length} bytes)`);

    try {
      const data = JSON.parse(message);

      if (data.kind === 'mic_lr_test') {
        addLog('success', 'Processing mic L/R response', {
          baseline_rms_L: data.payload?.baseline?.rms_L,
          baseline_rms_R: data.payload?.baseline?.rms_R,
          tone_rms_L: data.payload?.tone?.rms_L,
          tone_rms_R: data.payload?.tone?.rms_R
        });

        const payload = data.payload;
        if (payload && payload.tone) {
          const rmsL = payload.tone.rms_L;
          const rmsR = payload.tone.rms_R;

          const leftPassed = rmsL > QC_THRESHOLD;
          const rightPassed = rmsR > QC_THRESHOLD;
          const overallPassed = leftPassed && rightPassed;

          addLog('info', 'Microphone evaluation', {
            left_channel: `${rmsL.toFixed(1)} RMS - ${leftPassed ? 'PASS' : 'FAIL'}`,
            right_channel: `${rmsR.toFixed(1)} RMS - ${rightPassed ? 'PASS' : 'FAIL'}`,
            threshold: QC_THRESHOLD,
            result: overallPassed ? 'PASS' : 'FAIL'
          });

          let details = `L: ${rmsL.toFixed(1)} RMS (${leftPassed ? 'PASS' : 'FAIL'}), ` +
                       `R: ${rmsR.toFixed(1)} RMS (${rightPassed ? 'PASS' : 'FAIL'}) ` +
                       `[Threshold: >${QC_THRESHOLD}]`;

          if (!overallPassed) {
            const failedChannels = [];
            if (!leftPassed) failedChannels.push(`Left (${rmsL.toFixed(1)})`);
            if (!rightPassed) failedChannels.push(`Right (${rmsR.toFixed(1)})`);
            details += ` - Failed: ${failedChannels.join(', ')}`;
          }

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
          addLog('error', 'Mic L/R test: no valid tone data', data);
          handleTestResult({
            name: "Test Mic L/R Balance",
            status: 'fail',
            details: 'Error: No valid tone data',
            raw_response: data
          });
          return;
        }
      } else {
        addLog('info', `JSON message (kind: ${data.kind || 'unknown'})`, data);
      }
    } catch (e) {
      addLog('warning', `Text message: ${message}`, { parse_error: e.message });
    }
  }, [addLog, handleTestResult, QC_THRESHOLD]);

  const runNextTest = useCallback(async (testIndex = currentTestIndex) => {
    if (currentTestId.current) {
      addLog('warning', 'Test already running');
      return;
    }

    const test = tests[testIndex];
    if (!test) {
      addLog('warning', `Test not found at index ${testIndex}`);
      return;
    }

    currentTestStartTime.current = Date.now();
    const commandId = `${test.command}_${Date.now()}`;
    currentTestId.current = commandId;

    addLog('info', `Starting test: ${test.name}`, {
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
      addLog('info', 'Command sent, waiting for response...');

      testTimeoutRef.current = setTimeout(() => {
        if (currentTestId.current === commandId) {
          handleTestTimeout(test.name);
        }
      }, test.timeout);
    } else {
      currentTestId.current = null;
      handleTestResult({
        name: test.name,
        status: 'fail',
        details: 'Error sending command',
        error: 'SEND_FAILED'
      });
    }
  }, [tests, currentTestIndex, sendCommand, handleTestTimeout, handleTestResult, addLog]);

  const connectBluetooth = useCallback(async () => {
    addLog('info', 'Starting Bluetooth connection');

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [QA_SERVICE_UUID] }],
        optionalServices: [QA_SERVICE_UUID]
      });

      bluetoothDevice.current = device;
      addLog('success', `Device selected: ${device.name || device.id}`);

      const server = await device.gatt.connect();
      addLog('success', 'Connected to GATT server');

      const service = await server.getPrimaryService(QA_SERVICE_UUID);
      addLog('success', 'QA service obtained');

      const [controlChar, eventsChar] = await Promise.all([
        service.getCharacteristic(QA_CONTROL_UUID),
        service.getCharacteristic(QA_EVENTS_UUID)
      ]);

      commandCharacteristic.current = controlChar;
      logCharacteristic.current = eventsChar;

      await eventsChar.startNotifications();
      eventsChar.addEventListener('characteristicvaluechanged', handleNotifications);

      addLog('success', 'Characteristics configured and notifications started');
      return true;

    } catch (error) {
      addLog('error', `Bluetooth connection error: ${error.message}`, error);
      return false;
    }
  }, [addLog, handleNotifications, QA_SERVICE_UUID, QA_CONTROL_UUID, QA_EVENTS_UUID]);

  const startQCTests = useCallback(async () => {
    addLog('info', 'Starting QC tests sequence');

    // Reset test state
    setTestResults([]);
    setTestCompleted(false);
    setProgress(0);
    setCurrentTestIndex(0);

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
      addLog('success', 'Bluetooth connected, starting tests');
      setIsTestingInProgress(true);
    } else {
      addLog('error', 'Bluetooth connection failed, tests cancelled');
      alert('Error connecting to Bluetooth device. Please try again.');
    }
  }, [addLog, connectBluetooth]);

  const resetAndRestart = () => {
    if (testTimeoutRef.current) {
      clearTimeout(testTimeoutRef.current);
    }
    if (bluetoothDevice.current && bluetoothDevice.current.gatt.connected) {
      addLog('info', 'Disconnecting from device...');
      bluetoothDevice.current.gatt.disconnect();
    }
    if (logCharacteristic.current) {
      logCharacteristic.current.removeEventListener('characteristicvaluechanged', handleNotifications);
    }
    bluetoothDevice.current = null;
    logCharacteristic.current = null;
    commandCharacteristic.current = null;
    
    setLogs([]);
    setTestResults([]);
    setTestCompleted(false);
    setIsTestingInProgress(false);
    setProgress(0);
    setCurrentTestIndex(0);
    currentTestId.current = null;
  };

  // Auto-run next test when index changes
  useEffect(() => {
    if (isTestingInProgress && currentTestIndex >= 0 && currentTestIndex < tests.length) {
      const delay = 1500;
      const timeoutId = setTimeout(() => {
        runNextTest(currentTestIndex);
      }, delay);

      return () => clearTimeout(timeoutId);
    }
  }, [currentTestIndex, isTestingInProgress, tests.length, runNextTest]);

  useEffect(() => {
    return () => {
      if (testTimeoutRef.current) {
        clearTimeout(testTimeoutRef.current);
      }
      if (bluetoothDevice.current && bluetoothDevice.current.gatt.connected) {
        bluetoothDevice.current.gatt.disconnect();
      }
      if (logCharacteristic.current) {
        logCharacteristic.current.removeEventListener('characteristicvaluechanged', handleNotifications);
      }
    };
  }, [handleNotifications]);

  const currentTest = tests[currentTestIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-6">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,.03) 10px, rgba(255,255,255,.03) 20px)`
        }}></div>
      </div>

      <div className="relative z-10 max-w-4xl w-full">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full mb-4 shadow-2xl">
            <Bluetooth className="w-10 h-10 text-white" />
          </div>
          
          <h1 className="text-4xl font-bold text-white mb-2">
            {t('quick_qc_station')}
          </h1>
          <p className="text-lg text-blue-200 mb-6">
            {t('quick_qc_subtitle')}
          </p>

          <LanguageSelector />
        </motion.div>

        <AnimatePresence mode="wait">
          {!isTestingInProgress && !testCompleted && (
            <motion.div
              key="start"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl">
                <CardContent className="p-12">
                  <div className="space-y-6">
                    <div className="text-center space-y-4">
                      <div className="flex items-center justify-center gap-3 text-blue-200 mb-6">
                        <Bluetooth className="w-5 h-5" />
                        <p className="text-sm">
                          {t('ensure_device_on_range')}
                        </p>
                      </div>
                      
                      <Button
                        onClick={startQCTests}
                        className="w-full h-24 text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
                      >
                        <Bluetooth className="w-8 h-8 mr-3" />
                        {t('start_qc_test')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {isTestingInProgress && (
            <motion.div
              key="progress"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl">
                <CardContent className="p-8">
                  <div className="space-y-6">
                    <div className="text-center">
                      <h2 className="text-2xl font-bold text-white mb-4">
                        ⚙️ {t('running_tests')}
                      </h2>
                      
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-blue-200">
                          Test {currentTestIndex + 1} of {tests.length}
                        </span>
                        <span className="text-sm text-blue-200">
                          {Math.round(progress)}% completed
                        </span>
                      </div>

                      <div className="w-full bg-slate-700 rounded-full h-2 mb-6">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      {currentTest && (
                        <div className="flex items-center justify-center gap-3 p-4 bg-blue-500/20 rounded-lg border border-blue-500/30">
                          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                          <div className="text-left">
                            <p className="text-white font-semibold">{currentTest.name}</p>
                            <p className="text-sm text-blue-200">{currentTest.description}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {testResults.length > 0 && (
                      <div className="space-y-2">
                        {testResults.map((result, idx) => (
                          <div key={idx} className={cn(
                            "flex items-center justify-between p-3 rounded-lg border",
                            result.status === 'pass' ? "bg-green-500/20 border-green-500/50" : "bg-red-500/20 border-red-500/50"
                          )}>
                            <div className="flex items-center gap-3">
                              {result.status === 'pass' ? (
                                <CheckCircle className="w-5 h-5 text-green-400" />
                              ) : (
                                <AlertTriangle className="w-5 h-5 text-red-400" />
                              )}
                              <div>
                                <p className="text-white font-medium">{result.name}</p>
                                {result.details && (
                                  <p className="text-xs text-blue-200">{result.details}</p>
                                )}
                                {result.elapsed_ms && (
                                  <p className="text-xs text-blue-300 flex items-center gap-1 mt-1">
                                    <Clock className="w-3 h-3" />
                                    {result.elapsed_ms}ms
                                  </p>
                                )}
                              </div>
                            </div>
                            <Badge className={result.status === 'pass' ? "bg-green-600 text-white" : "bg-red-600 text-white"}>
                              {result.status === 'pass' ? 'PASS' : 'FAIL'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="bg-slate-900/50 rounded-lg p-4 max-h-48 overflow-y-auto">
                      <h3 className="text-sm font-semibold text-blue-200 mb-2">{t('event_log')}:</h3>
                      <div className="space-y-1 text-xs font-mono">
                        {logs.slice(-10).map((log, i) => (
                          <div key={i} className={cn(
                            "text-blue-100",
                            log.type === 'error' && "text-red-300",
                            log.type === 'success' && "text-green-300",
                            log.type === 'warning' && "text-yellow-300"
                          )}>
                            [{log.localTime}] {log.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {testCompleted && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl">
                <CardContent className="p-8">
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className={cn(
                        "inline-flex items-center justify-center w-20 h-20 rounded-full mb-4",
                        testResults.every(r => r.status === 'pass') ? "bg-green-500" : "bg-red-500"
                      )}>
                        {testResults.every(r => r.status === 'pass') ? (
                          <CheckCircle className="w-10 h-10 text-white" />
                        ) : (
                          <AlertTriangle className="w-10 h-10 text-white" />
                        )}
                      </div>
                      
                      <h2 className="text-3xl font-bold text-white mb-2">
                        {testResults.every(r => r.status === 'pass') ? t('device_approved') : t('device_failed')}
                      </h2>
                      <p className="text-blue-200 mb-4">
                        {testResults.filter(r => r.status === 'pass').length} of {testResults.length} tests passed
                      </p>
                    </div>

                    <div className="space-y-3">
                      {testResults.map((result, idx) => (
                        <div key={idx} className={cn(
                          "p-4 rounded-lg border-2",
                          result.status === 'pass' && "bg-green-500/20 border-green-500/50",
                          result.status === 'fail' && "bg-red-500/20 border-red-500/50"
                        )}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white font-medium">{result.name}</span>
                            <Badge className={result.status === 'pass' ? "bg-green-600 text-white" : "bg-red-600 text-white"}>
                              {result.status === 'pass' ? 'PASS' : 'FAIL'}
                            </Badge>
                          </div>
                          {result.details && (
                            <p className="text-sm text-blue-200">{result.details}</p>
                          )}
                          {result.evaluation_data && (
                            <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-2 gap-4 text-sm">
                              <div className="text-center">
                                <p className="text-blue-300 mb-1">Left Channel</p>
                                <p className={cn(
                                  "font-bold text-lg",
                                  result.evaluation_data.left_passed ? "text-green-400" : "text-red-400"
                                )}>
                                  {result.evaluation_data.rms_L.toFixed(1)} RMS
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-blue-300 mb-1">Right Channel</p>
                                <p className={cn(
                                  "font-bold text-lg",
                                  result.evaluation_data.right_passed ? "text-green-400" : "text-red-400"
                                )}>
                                  {result.evaluation_data.rms_R.toFixed(1)} RMS
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <Button
                      onClick={resetAndRestart}
                      className="w-full h-16 text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                    >
                      {t('test_another_device')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}