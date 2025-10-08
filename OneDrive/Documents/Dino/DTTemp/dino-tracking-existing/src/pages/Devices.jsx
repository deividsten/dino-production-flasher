
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Device, DinosaurVersion, Component, WIPLoading } from "@/api/entities"; // Added WIPLoading
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cpu, CheckCircle, Loader2, ScanLine, Edit, Trash2, X, Search, Filter, TestTube, ArrowLeft, AlertTriangle } from "lucide-react"; // Added AlertTriangle
import { motion, AnimatePresence } from "framer-motion";
import DevicesList from "../components/devices/DevicesList";
import DeviceDetails from "../components/devices/DeviceDetails";
import DeviceQCModal from "../components/devices/DeviceQCModal";
import GuidedDeviceRegistration from "../components/devices/GuidedDeviceRegistration";
import DeviceEditForm from "../components/devices/DeviceEditForm";
import { useLanguage } from "@/components/LanguageProvider";
import { Alert, AlertDescription } from "@/components/ui/alert"; // Added Alert components
import { useWarehouse } from "@/components/WarehouseProvider"; // NEW IMPORT

export default function DevicesPage() {
  const { t } = useLanguage();
  const { activeWarehouse, filterByWarehouse } = useWarehouse(); // NEW

  const [devices, setDevices] = useState([]);
  const [versions, setVersions] = useState([]);
  const [components, setComponents] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  
  const [selectedDeviceForDetails, setSelectedDeviceForDetails] = useState(null);
  const [editingDevice, setEditingDevice] = useState(null);
  const [isQCOpen, setIsQCOpen] = useState(false);
  const [isGuidedRegistrationOpen, setIsGuidedRegistrationOpen] = useState(false);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [versionFilter, setVersionFilter] = useState("all");
  
  // Replaced form states by stepFormData for new registration flow
  const [lastRegistered, setLastRegistered] = useState(null);
  const serialInputRefs = useRef({}); // Reused for serial scanning in step-by-step

  // New step-by-step registration states
  const [currentStep, setCurrentStep] = useState('version');
  const [stepFormData, setStepFormData] = useState({
    version_id: "",
    device_id: "",
    serial_inputs: {},
    notes: ""
  });
  
  const registrationSteps = ['version', 'device_id', 'serials', 'notes', 'submit'];

  // WIP Loading states
  const [activeWIP, setActiveWIP] = useState(null); // Changed from todayWIP to activeWIP
  const [wipCheckDone, setWipCheckDone] = useState(false);

  // Renamed loadInitialData to loadData and added filterByWarehouse dependency
  const loadData = useCallback(async () => { // Renamed from loadInitialData
    // CRITICAL: Don't load if no active warehouse
    if (!activeWarehouse) {
      setIsLoading(false);
      setWipCheckDone(true);
      return;
    }

    setIsLoading(true);
    try {
      const [devicesData, versionsData, componentsData, wipsData] = await Promise.all([
        Device.list('-created_date'),
        DinosaurVersion.list('-created_date'), // Added -created_date as per outline
        Component.list(),
        WIPLoading.list('-created_at') // Changed to -created_at for consistency
      ]);
      
      console.log('🔍 DEBUG - All WIPs:', wipsData);
      console.log('🔍 DEBUG - Active Warehouse:', activeWarehouse);
      
      // Apply warehouse filter to devicesData
      const filteredDevices = filterByWarehouse(devicesData); // NEW
      setDevices(filteredDevices); // Updated to filteredDevices
      setVersions(versionsData);
      setComponents(componentsData);
      
      // Get the most recent active WIP for the current warehouse
      const activeWIPData = wipsData.find(w => {
        console.log('🔍 Checking WIP:', {
          wipId: w.id,
          status: w.status,
          warehouseId: w.warehouse_id,
          currentWarehouse: activeWarehouse.id,
          match: w.status === 'active' && w.warehouse_id === activeWarehouse.id
        });
        return w.status === 'active' && w.warehouse_id === activeWarehouse.id;
      });
      
      console.log('✅ Active WIP found:', activeWIPData);
      
      setActiveWIP(activeWIPData); // Changed setTodayWIP to setActiveWIP
      setWipCheckDone(true);
    } catch (error) {
      console.error("Error loading data:", error);
      setWipCheckDone(true); // Ensure check is marked as done even on error
    }
    setIsLoading(false);
  }, [filterByWarehouse, activeWarehouse]); // Added dependencies to useCallback

  useEffect(() => {
    if (activeWarehouse) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData, activeWarehouse]); // Updated dependency to loadData

  useEffect(() => {
    // Check for edit mode from URL (retained as per original code)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('editDevice') === 'true') {
        const deviceToEditData = sessionStorage.getItem('editDevice');
        if (deviceToEditData) {
            const deviceToEdit = JSON.parse(deviceToEditData);
            setEditingDevice(deviceToEdit); // `editingDevice` state is still set
            // The following setters would have pre-filled the old form, but are no longer directly relevant for the new step-by-step creation form.
            sessionStorage.removeItem('editDevice');
            window.history.replaceState({}, document.title, window.location.pathname);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
  }, []);

  const loadDevices = async () => {
    if (!activeWarehouse) {
      // Don't load devices if no active warehouse is selected.
      // This function is generally called after `loadData` or after a successful device creation
      // so `activeWarehouse` should usually be present. But as a safeguard:
      setDevices([]);
      return;
    }
    const devicesData = await Device.list('-created_date');
    const filteredDevices = filterByWarehouse(devicesData); // NEW: Apply warehouse filter
    setDevices(filteredDevices);
  }

  const resetStepForm = () => {
    setStepFormData({
      version_id: "",
      device_id: "",
      serial_inputs: {},
      notes: ""
    });
    setCurrentStep('version');
    setIsRegistering(false);
    setEditingDevice(null); // Clear editing state when resetting form for a new registration flow
  };

  const getCurrentOperator = () => {
    try {
      const operatorData = localStorage.getItem('dinotrack-operator');
      if (operatorData) {
        return JSON.parse(operatorData);
      }
    } catch (error) {
      console.error("Error reading operator from localStorage:", error);
    }
    return null;
  };

  const handleStepSubmit = async () => {
    // No e.preventDefault() here as it's called by a button onClick, not a form onSubmit directly.
    
    // Check if activeWarehouse exists FIRST
    if (!activeWarehouse) {
      alert('⚠️ No hay warehouse activo seleccionado. Por favor selecciona un warehouse primero.');
      setIsRegistering(false);
      return;
    }

    console.log('🔍 DEBUG - Checking WIP before submit:', {
      activeWIP: activeWIP,
      hasWIP: !!activeWIP,
      wipStatus: activeWIP?.status,
      wipWarehouse: activeWIP?.warehouse_id,
      currentWarehouse: activeWarehouse.id
    });

    // Check WIP Loading requirement
    if (!activeWIP) { // Changed from todayWIP
      alert('⚠️ No se puede registrar dispositivos. No hay WIP Loading activo para el almacén actual.\n\nPor favor, ve a la sección "WIP Loading" y carga los bins antes de continuar.');
      setIsRegistering(false); // Ensure registration state is reset if blocked
      return;
    }

    if (!stepFormData.device_id || !stepFormData.version_id) {
      alert(t('please_complete_version_and_id'));
      setIsRegistering(false);
      return;
    }

    // Verify that the selected version matches the WIP version
    if (stepFormData.version_id !== activeWIP.version_id) { // Changed from todayWIP
      alert(`⚠️ La versión seleccionada no coincide con el WIP Loading activo.\n\nWIP activo: ${versions.find(v => v.id === activeWIP.version_id)?.model_name}\nPor favor selecciona la versión correcta.`);
      setIsRegistering(false);
      return;
    }
    
    setIsRegistering(true);

    const selectedVersion = versions.find(v => v.id === stepFormData.version_id);
    const versionBom = selectedVersion?.components || [];
    const unitComponents = versionBom.filter(c => c.tracking_type === 'unidad');
    
    const allUnitSerialsScanned = unitComponents.every(comp => 
      stepFormData.serial_inputs[comp.component_id] && 
      stepFormData.serial_inputs[comp.component_id].trim() !== ''
    );

    if (unitComponents.length > 0 && !allUnitSerialsScanned) {
      alert(t('please_scan_all_required_serials'));
      setIsRegistering(false);
      return;
    }

    // Build components_used array and CHECK BIN AVAILABILITY
    const componentsForDevice = [];
    const binsToUpdate = []; // Array to track consumed components for WIP update
    
    // CRITICAL FIX: Use bins_loaded instead of batches_loaded
    const wipBins = activeWIP.bins_loaded || [];
    console.log('🔍 DEBUG - WIP Bins:', wipBins);
    
    for (const comp of versionBom) {
      const newComponentEntry = {
        component_id: comp.component_id,
        component_name: comp.component_name,
        tracking_type: comp.tracking_type,
        batch_number: null, // Renamed to bin_number for consistency, but backend might still expect batch_number
        serial_number: ""
      };

      if (comp.tracking_type === 'lote') {
        // CRITICAL FIX: Search in bins_loaded
        const wipBin = wipBins.find(b => b.component_id === comp.component_id);
        
        console.log('🔍 DEBUG - Looking for bin:', {
          componentId: comp.component_id,
          componentName: comp.component_name,
          foundBin: wipBin
        });

        if (!wipBin) {
          alert(`⚠️ Error: El componente "${comp.component_name}" no fue cargado en el WIP Loading.\n\nPor favor ve a WIP Loading y carga el bin de este componente.`);
          setIsRegistering(false);
          return;
        }
        
        // Check if bin has available quantity (quantity_loaded vs quantity_consumed)
        const remaining = wipBin.quantity_loaded - (wipBin.quantity_consumed || 0);
        if (remaining <= 0) {
          alert(`⚠️ BIN AGOTADO: El bin "${wipBin.bin_number}" del componente "${comp.component_name}" se ha agotado.\n\nDisponible: ${remaining} unidades\n\nPor favor ve a WIP Loading y carga un nuevo bin de este componente.`);
          setIsRegistering(false);
          return;
        }
        
        newComponentEntry.batch_number = wipBin.bin_number; // Keep batch_number for consistency with Device model field
        
        // Track this bin for consumption update
        binsToUpdate.push({
          component_id: comp.component_id,
          quantity_consumed: (wipBin.quantity_consumed || 0) + 1
        });
        
      } else if (comp.tracking_type === 'unidad') {
        newComponentEntry.serial_number = stepFormData.serial_inputs[comp.component_id] || "";
      }

      componentsForDevice.push(newComponentEntry);
    }

    const currentOperator = getCurrentOperator();

    const deviceData = {
      device_id: stepFormData.device_id,
      version_id: stepFormData.version_id,
      components_used: componentsForDevice,
      notes: stepFormData.notes,
      status: "ready",
      assembly_date: new Date().toISOString(),
      assembled_by_operator: currentOperator?.name || 'Desconocido',
      warehouse_id: activeWarehouse.id // NEW: Add active warehouse ID to new device
    };

    try {
      const savedDevice = await Device.create(deviceData);
      
      // CRITICAL FIX: Update bins_loaded consumption
      const updatedBins = wipBins.map(bin => {
        const update = binsToUpdate.find(u => u.component_id === bin.component_id);
        if (update) {
          return {
            ...bin,
            quantity_consumed: update.quantity_consumed
          };
        }
        return bin;
      });
      
      await WIPLoading.update(activeWIP.id, { // Changed from todayWIP.id
        bins_loaded: updatedBins // CRITICAL FIX: Update bins_loaded
      });
      
      setLastRegistered(savedDevice);
      loadDevices();
      resetStepForm();
      
      // Reload WIP data to reflect the updated consumption immediately
      // This also needs to respect the activeWarehouse.
      const wipsData = await WIPLoading.list('-created_at'); // Changed to -created_at
      const updatedWIP = wipsData.find(w => w.status === 'active' && w.warehouse_id === activeWarehouse.id); // Find any active WIP for the current warehouse
      setActiveWIP(updatedWIP); // Changed setTodayWIP to setActiveWIP
      
      // Check if any bins are running low and show warning
      const lowBins = updatedBins.filter(b => {
        const remaining = b.quantity_loaded - b.quantity_consumed; // CRITICAL FIX: Use quantity_loaded
        return remaining <= 5 && remaining > 0;
      });
      
      if (lowBins.length > 0) {
        const warnings = lowBins.map(b => 
          `• ${b.component_name}: ${b.quantity_loaded - b.quantity_consumed} unidades restantes` // CRITICAL FIX: Use quantity_loaded
        ).join('\n');
        
        // Use setTimeout to allow the registration success message to display first
        setTimeout(() => {
          alert(`⚠️ ADVERTENCIA: Bins con poco stock:\n\n${warnings}\n\nConsidera recargar estos bins pronto.`);
        }, 1000);
      }
      
    } catch (error) {
      console.error("Error saving device:", error);
      alert(t('error_saving_device') + error.message);
    } finally {
      setIsRegistering(false); // Ensure registration state is reset
    }
  };

  const handleDeleteDevice = async (deviceToDelete) => {
    if (!window.confirm(t('confirm_delete_device', { deviceId: deviceToDelete.device_id }))) {
        return;
    }
    try {
        await Device.delete(deviceToDelete.id);
        setDevices(prevDevices => prevDevices.filter(d => d.id !== deviceToDelete.id));
        if (selectedDeviceForDetails?.id === deviceToDelete.id) {
            setSelectedDeviceForDetails(null);
        }
        if (editingDevice?.id === deviceToDelete.id) {
            resetStepForm(); // Clear editing state if the device being edited is deleted
        }
    } catch (error) {
        console.error("Error deleting device:", error);
        alert(t('error_deleting_device') + error.message);
    }
  };

  const handleEditDevice = (device) => {
    setEditingDevice(device);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step-by-step navigation functions
  const goBackStep = () => {
    const currentIndex = registrationSteps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(registrationSteps[currentIndex - 1]);
    }
  };

  const handleDeviceIdKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setCurrentStep('serials'); // Move to serials step
    }
  };

  const handleSerialKeyDown = (e, currentIndex, unitComponents) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextIndex = currentIndex + 1;
      
      if (nextIndex < unitComponents.length) {
        const nextComponentId = unitComponents[nextIndex].component_id;
        serialInputRefs.current[nextComponentId]?.focus();
      } else {
        setCurrentStep('notes'); // Move to notes step if all serials are entered
      }
    }
  };
  
  // Get BOM for current step version
  const selectedStepVersion = versions.find(v => v.id === stepFormData.version_id);
  const stepBom = selectedStepVersion?.components || [];
  const stepUnitComponents = stepBom.filter(c => c.tracking_type === 'unidad');
  const stepIndex = registrationSteps.indexOf(currentStep);
  const stepProgressPercentage = stepIndex >= 0 ? ((stepIndex + 1) / registrationSteps.length) * 100 : 0;

  // Filter devices based on search and filters
  const filteredDevices = devices.filter(device => {
    const matchesSearch = searchTerm === "" || 
      device.device_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (device.notes && device.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (device.components_used && device.components_used.some(comp => 
        comp.serial_number && comp.serial_number.toLowerCase().includes(searchTerm.toLowerCase())
      ));
    
    const matchesStatus = statusFilter === "all" || device.status === statusFilter;
    const matchesVersion = versionFilter === "all" || device.version_id === versionFilter;
    
    return matchesSearch && matchesStatus && matchesVersion;
  });

  if (isLoading || !wipCheckDone || !activeWarehouse) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            {t('device_registration_station')}
          </h1>
          <p className="text-slate-600">
            {t('register_devices_step_by_step')}
          </p>
        </motion.div>

        {/* WIP Loading Warning */}
        {wipCheckDone && !activeWIP && ( // Updated condition
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Alert className="bg-red-50 border-2 border-red-300">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <AlertDescription className="text-red-800 font-semibold text-lg">
                ⛔ BLOQUEADO: No hay WIP Loading activo para el almacén actual. No se pueden registrar dispositivos hasta que se carguen lotes en WIP Loading.
                <br />
                <a href="/WIPLoading" className="underline text-red-900 hover:text-red-700 mt-2 inline-block">
                  → Ir a WIP Loading
                </a>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* WIP Loading Info Banner */}
        {wipCheckDone && activeWIP && ( // Updated condition
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <div>
                      <p className="font-semibold text-green-800">
                        WIP Activo: {versions.find(v => v.id === activeWIP.version_id)?.model_name}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        {activeWIP.bins_loaded?.map((bin, idx) => { // Changed to bins_loaded
                          const remaining = bin.quantity_loaded - (bin.quantity_consumed || 0); // Changed to quantity_loaded
                          const isLow = remaining <= 10; // Consider low if 10 or less remaining
                          const isEmpty = remaining <= 0;
                          
                          return (
                            <span key={bin.component_id || idx} className={`text-sm ${
                              isEmpty ? 'text-red-700 font-bold' :
                              isLow ? 'text-yellow-700 font-semibold' :
                              'text-green-700'
                            }`}>
                              {bin.component_name}: {remaining}/{bin.quantity_loaded} {/* Changed to quantity_loaded */}
                              {isEmpty && ' ⚠️ AGOTADO'}
                              {isLow && !isEmpty && ' ⚠️'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Registration Form - Only show if WIP is active */}
        {activeWIP && ( // Updated condition
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="bg-white/90 backdrop-blur-sm shadow-2xl border-0">
              <CardHeader className="text-center">
                <div className="flex justify-center items-center gap-3 mb-2">
                  <Cpu className="w-7 h-7 text-purple-600" />
                  <CardTitle className="text-2xl font-bold text-slate-800">
                    {t('device_registration_assistant')}
                  </CardTitle>
                </div>
                <p className="text-slate-500">{t('step_x_of_y', { current: stepIndex + 1, total: registrationSteps.length })}</p>
              </CardHeader>
              <CardContent className="p-8">
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-8">
                  <div className="bg-purple-600 h-2.5 rounded-full transition-all duration-300" style={{width: `${stepProgressPercentage}%`}}></div>
                </div>

                <div className="relative min-h-[200px]">
                  <AnimatePresence mode="wait">
                    {currentStep === 'version' && (
                      <motion.div
                        key="version"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center gap-3">
                          <Cpu className="w-6 h-6 text-purple-600"/>
                          <h3 className="text-xl font-semibold text-slate-700">{t('select_dinosaur_version')}</h3>
                        </div>
                        <Select 
                          value={stepFormData.version_id} 
                          onValueChange={(value) => { 
                            setStepFormData(prev => ({...prev, version_id: value})); 
                            setCurrentStep('device_id'); 
                          }} 
                          required
                        >
                          <SelectTrigger className="bg-white/70 h-12 text-lg">
                            <SelectValue placeholder={t('choose_version')} />
                          </SelectTrigger>
                          <SelectContent>
                            {versions.map(version => (
                              <SelectItem key={version.id} value={version.id}>{version.model_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </motion.div>
                    )}

                    {currentStep === 'device_id' && (
                      <motion.div
                        key="device_id"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center gap-3">
                          <ScanLine className="w-6 h-6 text-purple-600"/>
                          <h3 className="text-xl font-semibold text-slate-700">{t('scan_device_id')}</h3>
                        </div>
                        <Input
                          value={stepFormData.device_id}
                          onChange={(e) => setStepFormData(prev => ({...prev, device_id: e.target.value}))}
                          onKeyDown={handleDeviceIdKeyDown}
                          placeholder={t('scan_or_enter_device_id')}
                          className="font-mono text-lg h-12 bg-white/70"
                          autoComplete="off"
                          autoFocus
                        />
                      </motion.div>
                    )}

                    {currentStep === 'serials' && stepUnitComponents.length > 0 && (
                      <motion.div
                        key="serials"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center gap-3">
                          <ScanLine className="w-6 h-6 text-purple-600"/>
                          <h3 className="text-xl font-semibold text-slate-700">{t('scan_serial_numbers')}</h3>
                        </div>
                        <div className="space-y-4 rounded-lg bg-slate-50 p-4 border">
                          {stepUnitComponents.map((comp, index) => (
                            <div key={comp.component_id} className="grid grid-cols-1 sm:grid-cols-3 items-center gap-3">
                              <Label className="sm:col-span-1 text-sm">{comp.component_name}</Label>
                              <div className="relative sm:col-span-2">
                                <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input 
                                  id={`serial-${comp.component_id}`} 
                                  ref={el => serialInputRefs.current[comp.component_id] = el}
                                  value={stepFormData.serial_inputs[comp.component_id] || ""} 
                                  onChange={e => setStepFormData(prev => ({ 
                                    ...prev, 
                                    serial_inputs: {...prev.serial_inputs, [comp.component_id]: e.target.value} 
                                  }))} 
                                  onKeyDown={(e) => handleSerialKeyDown(e, index, stepUnitComponents)}
                                  placeholder={t('scan_serial_number')} 
                                  className="font-mono pl-10 bg-white"
                                  autoFocus={index === 0}
                                />
                              </div>
                            </div>
                          ))}
                          <Button onClick={() => setCurrentStep('notes')} className="mt-4 w-full">
                            {t('continue')}
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {currentStep === 'serials' && stepUnitComponents.length === 0 && (
                      <motion.div
                        key="no-serials"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-6 h-6 text-green-600"/>
                          <h3 className="text-xl font-semibold text-slate-700">{t('no_serial_components_required')}</h3>
                        </div>
                        <p className="text-slate-600">{t('this_version_no_serials')}</p>
                        <Button onClick={() => setCurrentStep('notes')} className="w-full">
                          {t('continue_to_notes')}
                        </Button>
                      </motion.div>
                    )}

                    {currentStep === 'notes' && (
                      <motion.div
                        key="notes"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center gap-3">
                          <Edit className="w-6 h-6 text-purple-600"/>
                          <h3 className="text-xl font-semibold text-slate-700">{t('additional_notes_optional_device')}</h3>
                        </div>
                        <Textarea
                          value={stepFormData.notes}
                          onChange={(e) => setStepFormData(prev => ({...prev, notes: e.target.value}))}
                          placeholder={t('assembly_observations')}
                          className="bg-white/70"
                          autoFocus
                        />
                        <Button onClick={() => setCurrentStep('submit')} className="mt-4 w-full">
                          {t('continue')}
                        </Button>
                      </motion.div>
                    )}

                    {currentStep === 'submit' && (
                      <motion.div
                        key="submit"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-6 h-6 text-green-600"/>
                          <h3 className="text-xl font-semibold text-slate-700">{t('confirm_and_register')}</h3>
                        </div>
                        <div className="space-y-3 rounded-lg bg-slate-50 p-4 border mb-6">
                          <div className="flex justify-between">
                            <span className="text-slate-500">{t('version')}:</span>
                            <span className="font-semibold">{selectedStepVersion?.model_name || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">{t('device_id')}:</span>
                            <span className="font-mono bg-slate-200 px-2 py-1 rounded">{stepFormData.device_id || 'N/A'}</span>
                          </div>
                          {stepUnitComponents.length > 0 && (
                            <div className="pt-2 border-t">
                              <p className="text-slate-500 text-sm mb-2">{t('components_with_serial')}:</p>
                              {stepUnitComponents.map(comp => (
                                <div key={comp.component_id} className="flex justify-between text-sm">
                                  <span>{comp.component_name}:</span>
                                  <span className="font-mono">{stepFormData.serial_inputs[comp.component_id] || 'N/A'}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {stepFormData.notes && (
                            <div className="pt-2 border-t">
                              <p className="text-slate-500 text-sm italic">"{stepFormData.notes}"</p>
                            </div>
                          )}
                        </div>
                        
                        <Button 
                          onClick={handleStepSubmit} 
                          className="w-full h-14 text-lg bg-gradient-to-r from-purple-600 to-indigo-600" 
                          disabled={isRegistering}
                        >
                          {isRegistering ? (
                            <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle className="w-6 h-6 mr-2" />
                          )}
                          {t('register_device')}
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {currentStep !== 'version' && (
                  <Button variant="ghost" onClick={goBackStep} className="absolute bottom-6 left-8 text-slate-500">
                    <ArrowLeft className="w-4 h-4 mr-2"/>
                    {t('back')}
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        <AnimatePresence>
          {lastRegistered && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              onAnimationComplete={() => setTimeout(() => setLastRegistered(null), 3000)}
              className="p-4 bg-purple-100 border border-purple-200 text-purple-800 rounded-lg shadow-md"
            >
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5" />
                <p className="font-medium">
                  {t('device_registered_successfully')}{' '}
                  <span className="font-mono bg-white/70 px-1 rounded">{lastRegistered.device_id}</span>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search and Filter Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder={t('search_by_id_notes_serials')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white/50"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-white/50">
                <SelectValue placeholder={t('status_placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_statuses')}</SelectItem>
                <SelectItem value="ready">{t('ready')}</SelectItem>
                <SelectItem value="used">{t('used')}</SelectItem>
                <SelectItem value="defective">{t('defective')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={versionFilter} onValueChange={setVersionFilter}>
              <SelectTrigger className="bg-white/50">
                <SelectValue placeholder={t('version_placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_versions')}</SelectItem>
                {versions.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.model_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-4 text-sm text-slate-600">
            {t('showing_x_of_y_devices', { filtered: filteredDevices.length, total: devices.length })}
          </div>
        </motion.div>

        {/* This block will now correctly show loading while activeWarehouse is null/undefined */}
        {isLoading || !wipCheckDone || !activeWarehouse ? ( 
          <div className="flex justify-center items-center p-12">
            <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <DevicesList 
              devices={filteredDevices} 
              versions={versions} 
              onEdit={handleEditDevice}
              onDelete={handleDeleteDevice}
              onViewDetails={setSelectedDeviceForDetails}
            />
          </motion.div>
        )}
      </div>
      
      {/* Device Details Modal */}
      <AnimatePresence>
        {selectedDeviceForDetails && (
          <DeviceDetails 
            device={selectedDeviceForDetails}
            versions={versions}
            onClose={() => setSelectedDeviceForDetails(null)}
          />
        )}
      </AnimatePresence>

      {/* Device Edit Modal */}
      <AnimatePresence>
        {editingDevice && (
          <DeviceEditForm
            device={editingDevice}
            versions={versions}
            components={components} // Pass components for the form
            onSave={(updatedDevice) => {
              setEditingDevice(null);
              loadDevices();
            }}
            onCancel={() => setEditingDevice(null)}
          />
        )}
      </AnimatePresence>
      
      {/* QC Modal */}
      <AnimatePresence>
        {isQCOpen && <DeviceQCModal onClose={() => setIsQCOpen(false)} />}
      </AnimatePresence>

      {/* Guided Registration Modal (if you want to keep it as an alternative) */}
      <AnimatePresence>
        {isGuidedRegistrationOpen && (
          <GuidedDeviceRegistration
            versions={versions}
            onClose={() => setIsGuidedRegistrationOpen(false)}
            onSuccess={(savedDevice) => {
              setLastRegistered(savedDevice);
              loadDevices();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
