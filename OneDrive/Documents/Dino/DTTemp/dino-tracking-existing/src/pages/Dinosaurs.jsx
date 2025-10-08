
import React, { useState, useEffect } from "react";
import { Dinosaur, DinosaurVersion, Device } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Factory, ScanLine, CheckCircle, AlertTriangle, Loader2, Cpu, ArrowLeft, Palette, Fingerprint } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/LanguageProvider";
import { useWarehouse } from "@/components/WarehouseProvider";

import DinosaursList from "../components/dinosaurs/DinosaursList";
import DinosaurForm from "../components/dinosaurs/DinosaurForm";

const RegistrationStep = ({ title, icon, children }) => (
  <motion.div
    initial={{ opacity: 0, x: 50 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -50 }}
    transition={{ duration: 0.3 }}
    className="space-y-4"
  >
    <div className="flex items-center gap-3">
      {icon}
      <h3 className="text-xl font-semibold text-slate-700">{title}</h3>
    </div>
    {children}
  </motion.div>
);

export default function DinosaurusPage() {
  const { t } = useLanguage();
  const { activeWarehouse, filterByWarehouse } = useWarehouse();
  const [dinosaurs, setDinosaurs] = useState([]);
  const [versions, setVersions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [colorFilter, setColorFilter] = useState("all");
  const [versionFilter, setVersionFilter] = useState("all");
  
  // Quick registration form states
  const [currentStep, setCurrentStep] = useState('version');
  const [versionId, setVersionId] = useState("");
  const [rfidInput, setRfidInput] = useState("");
  const [rfid, setRfid] = useState("");
  const [lastProcessedRfid, setLastProcessedRfid] = useState("");
  const [recentRfidCodes, setRecentRfidCodes] = useState([]);
  const [deviceId, setDeviceId] = useState("");
  const [color, setColor] = useState("");
  const [notes, setNotes] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState(null);
  const [lastRegistered, setLastRegistered] = useState(null);
  const [deviceWarning, setDeviceWarning] = useState(null);
  const [editingDinosaur, setEditingDinosaur] = useState(null);
  const location = useLocation();

  const RFID_CODE_LENGTH = 24;
  const registrationSteps = ['version', 'color', 'rfid', 'device', 'notes', 'submit'];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const editId = params.get('edit_id');
    if (editId && dinosaurs.length > 0) {
      const dinoToEdit = dinosaurs.find(d => d.id === editId);
      if (dinoToEdit) {
        handleEditDinosaur(dinoToEdit);
      }
    }
  }, [location.search, dinosaurs]);

  const loadData = async () => {
    const [dinosaursData, versionsData] = await Promise.all([
      Dinosaur.list('-created_date'),
      DinosaurVersion.list('-created_date'),
    ]);
    
    // Filtrar por warehouse
    const filteredDinosaurs = filterByWarehouse(dinosaursData);
    setDinosaurs(filteredDinosaurs);
    setVersions(versionsData);
  };

  const handleEditDinosaur = (dinosaur) => {
    setEditingDinosaur(dinosaur);
  };

  const handleCloseEditModal = () => {
    setEditingDinosaur(null);
    window.history.pushState({}, '', createPageUrl('Dinosaurs'));
  };

  const handleUpdateDinosaur = async (updatedData) => {
    try {
      await Dinosaur.update(updatedData.id, updatedData);
      handleCloseEditModal();
      loadData();
    } catch (error) {
      console.error("Failed to update dinosaur:", error);
      alert("Error updating dinosaur: " + error.message);
    }
  };

  const handleRfidScanChange = (e) => {
    const value = e.target.value.trim();
    setRfidInput(value);

    if (error && error.type !== 'submit') setError(null);
    if (deviceWarning) setDeviceWarning(null);

    if (value.length === RFID_CODE_LENGTH) {
      if (value === lastProcessedRfid) {
        setRfidInput("");
        return;
      }

      const newRecentCodes = [...recentRfidCodes, value].slice(-3);
      setRecentRfidCodes(newRecentCodes);
      
      const uniqueCodes = [...new Set(newRecentCodes)];
      if (uniqueCodes.length > 1) {
        setError({ type: 'interference', message: t('interference_detected_rfids') });
        setTimeout(() => { setError(null); setRecentRfidCodes([]); setRfidInput(""); }, 2000);
        return;
      }

      setRfid(value);
      setLastProcessedRfid(value);
      setRfidInput("");
      setRecentRfidCodes([]);
      setCurrentStep('device');
      setTimeout(() => document.getElementById("device_input")?.focus(), 50);
    }
  };
  
  const handleDeviceIdChange = (e) => {
    setDeviceId(e.target.value);
    if (deviceWarning) setDeviceWarning(null);
    if (error && error.type !== 'submit') setError(null);
  };

  const handleDeviceIdKeyDown = (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        setCurrentStep('notes');
        setTimeout(() => document.getElementById("notes_input")?.focus(), 50);
    }
  };

  const resetRegistrationForm = () => {
    setRfid("");
    setRfidInput("");
    setLastProcessedRfid("");
    setRecentRfidCodes([]);
    setDeviceId("");
    setColor("");
    setNotes("");
    setError(null);
    setDeviceWarning(null);
    setIsRegistering(false);
    setVersionId("");
    setCurrentStep('version');
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

  const handleQuickRegister = async (e) => {
    e?.preventDefault();
    if (isRegistering) return;

    if (!versionId || !rfid || !deviceId.trim() || !color) {
      setError({ type: 'submit', message: t('missing_data_restart_process') });
      return;
    }

    setIsRegistering(true);
    setError(null);
    setDeviceWarning(null);

    const finalDeviceId = deviceId.trim();
    const currentOperator = getCurrentOperator();

    try {
      const deviceRecords = await Device.filter({ device_id: finalDeviceId });
      const deviceRecord = deviceRecords[0];

      const hasPassedQC = deviceRecord?.qc_results && 
        deviceRecord.qc_results.length > 0 && 
        deviceRecord.qc_results.every(test => test.status === 'pass');
      
      const isDefective = deviceRecord?.status === 'defective';
      
      if (!deviceRecord || !hasPassedQC || isDefective || deviceRecord.status !== 'ready') {
        let warningMessage = '';
        let warningType = '';

        if (!deviceRecord) {
          warningMessage = t('device_not_found_warning', { deviceId: finalDeviceId });
          warningType = 'device_not_found';
        } else if (isDefective) {
          warningMessage = t('device_defective_warning', { deviceId: finalDeviceId });
          warningType = 'device_defective';
        } else if (!hasPassedQC && deviceRecord.qc_results?.length > 0) {
          const failedTests = deviceRecord.qc_results.filter(test => test.status === 'fail').map(test => test.name).join(', ');
          warningMessage = t('qc_failed_warning', { deviceId: finalDeviceId, failedTests: failedTests });
          warningType = 'qc_failed';
        } else if (!hasPassedQC) {
          warningMessage = t('qc_not_tested_warning', { deviceId: finalDeviceId });
          warningType = 'qc_not_tested';
        } else if (deviceRecord.status !== 'ready') {
          warningMessage = t('device_not_ready_warning', { deviceId: finalDeviceId, status: deviceRecord.status });
          warningType = 'device_not_ready';
        }

        setDeviceWarning({
          message: warningMessage,
          warningType: warningType,
          data: { versionId, rfid, deviceId: finalDeviceId, color, notes, deviceRecord }
        });
        setIsRegistering(false);
        return;
      }
      
      // Get version and color info for SKU generation
      const version = versions.find(v => v.id === versionId);
      const colorInfo = version?.available_colors?.find(c => c.name === color);
      
      const dinosaurData = {
        warehouse_id: activeWarehouse?.id,
        version_id: versionId,
        device_id: finalDeviceId,
        rfid_code: rfid,
        color: color,
        color_code: colorInfo?.code || '',
        sku_final: colorInfo?.code && version?.sku_base ? 
          `${version.sku_base}-${colorInfo.code}-${version.version_number || '01'}` : '',
        status: 'available',
        assembly_date: new Date().toISOString(),
        assembled_by_operator: currentOperator?.name || 'Desconocido',
        notes: notes
      };

      const newDinosaur = await Dinosaur.create(dinosaurData);
      if (deviceRecord) {
        await Device.update(deviceRecord.id, { status: 'used' });
      }

      setLastRegistered(newDinosaur);
      loadData();
      resetRegistrationForm();

    } catch (err) {
      setError({ type: 'submit', message: err.message || t('error_registering_dinosaur') });
      setIsRegistering(false);
    }
  };

  const handleForceRegister = async () => {
    const { versionId, rfid, deviceId, color, notes, deviceRecord } = deviceWarning.data;
    setIsRegistering(true);
    setError(null);
    setDeviceWarning(null);

    let warningNote = '';
    switch (deviceWarning.warningType) {
      case 'device_defective':
        warningNote = t('force_register_note_defective', { deviceId: deviceId });
        break;
      case 'qc_failed':
        const failedTests = deviceRecord?.qc_results?.filter(test => test.status === 'fail').map(test => test.name).join(', ') || t('unknown_tests');
        warningNote = t('force_register_note_qc_failed', { deviceId: deviceId, failedTests: failedTests });
        break;
      case 'qc_not_tested':
        warningNote = t('force_register_note_qc_not_tested', { deviceId: deviceId });
        break;
      case 'device_not_ready':
        warningNote = t('force_register_note_not_ready', { deviceId: deviceId });
        break;
      case 'device_not_found':
      default:
        warningNote = t('force_register_note_device_not_found', { deviceId: deviceId });
        break;
    }

    const currentOperator = getCurrentOperator();
    const version = versions.find(v => v.id === versionId);
    const colorInfo = version?.available_colors?.find(c => c.name === color);

    const dinosaurData = {
      warehouse_id: activeWarehouse?.id,
      version_id: versionId,
      device_id: deviceId, 
      rfid_code: rfid,
      color: color,
      color_code: colorInfo?.code || '',
      sku_final: colorInfo?.code && version?.sku_base ? 
        `${version.sku_base}-${colorInfo.code}-${version.version_number || '01'}` : '',
      status: 'unverified',
      assembly_date: new Date().toISOString(),
      assembled_by_operator: currentOperator?.name || 'Desconocido',
      notes: `${notes || ''}\n\n${warningNote}`.trim()
    };

    try {
      const newDinosaur = await Dinosaur.create(dinosaurData);
      
      if (deviceRecord) {
        await Device.update(deviceRecord.id, { status: 'used' });
      }
      
      setLastRegistered(newDinosaur);
      loadData();
      resetRegistrationForm();
    } catch (err) {
      setError({ type: 'submit', message: err.message || t('error_force_register') });
      setIsRegistering(false);
    }
  };

  const handleDeleteDinosaur = async (dinosaur) => {
    if (dinosaur.status === 'sold') {
      alert(t('cannot_delete_sold_dinosaur'));
      return;
    }
    if (window.confirm(t('confirm_delete_dinosaur', { rfid_code: dinosaur.rfid_code }))) {
      await Dinosaur.delete(dinosaur.id);
      loadData();
    }
  };
  
  const goBackStep = () => {
    const currentIndex = registrationSteps.indexOf(currentStep);
    if (currentIndex > 0) {
        setCurrentStep(registrationSteps[currentIndex - 1]);
    }
  };

  // Filter dinosaurs based on search and filters
  const filteredDinosaurs = dinosaurs.filter(dino => {
    const matchesSearch = searchTerm === "" || 
      (dino.rfid_code && dino.rfid_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (dino.device_id && dino.device_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (dino.sku_final && dino.sku_final.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || dino.status === statusFilter;
    const matchesColor = colorFilter === "all" || dino.color === colorFilter;
    const matchesVersion = versionFilter === "all" || dino.version_id === versionFilter;
    
    return matchesSearch && matchesStatus && matchesColor && matchesVersion;
  });

  const selectedVersion = versions.find(v => v.id === versionId);
  const colorOptions = selectedVersion?.available_colors?.filter(c => c && c.name).map(c => c.name) || [];
  const stepIndex = registrationSteps.indexOf(currentStep);
  const progressPercentage = stepIndex >= 0 ? ((stepIndex + 1) / registrationSteps.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 p-6">
      <AnimatePresence>
        {editingDinosaur && (
          <DinosaurForm 
            dinosaur={editingDinosaur}
            versions={versions}
            onSave={handleUpdateDinosaur}
            onCancel={handleCloseEditModal}
          />
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-2">
              {t('dinosaur_registration_station')}
            </h1>
            <p className="text-slate-600">
              {t('register_dinosaurs_step_by_step')}
            </p>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex gap-3 w-full lg:w-auto">
            <Link to={createPageUrl('Devices')}>
              <Button variant="outline" className="w-full lg:w-auto bg-white/80">
                <Factory className="w-5 h-5 mr-2" />
                {t('assembly_station')}
              </Button>
            </Link>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="bg-white/90 backdrop-blur-sm shadow-2xl border-0">
            <CardHeader className="text-center">
              <div className="flex justify-center items-center gap-3 mb-2">
                <span className="text-3xl">🦖</span>
                <CardTitle className="text-2xl font-bold text-slate-800">
                  {t('registration_assistant')}
                </CardTitle>
              </div>
              <p className="text-slate-500">{t('step_x_of_y', { current: stepIndex + 1, total: registrationSteps.length })}</p>
            </CardHeader>
            <CardContent className="p-8">
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-8">
                  <div className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300" style={{width: `${progressPercentage}%`}}></div>
              </div>

              <div className="relative min-h-[150px]">
                <AnimatePresence mode="wait">
                  {currentStep === 'version' && (
                    <RegistrationStep key="version" title={t('select_dinosaur_version_step')} icon={<Factory className="w-6 h-6 text-emerald-600"/>}>
                      <Select value={versionId} onValueChange={(value) => { setVersionId(value); setCurrentStep('color'); }} required>
                        <SelectTrigger className="bg-white/70 h-12 text-lg">
                          <SelectValue placeholder={t('choose_version')} />
                        </SelectTrigger>
                        <SelectContent>
                          {versions.map(version => <SelectItem key={version.id} value={version.id}>{version.model_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </RegistrationStep>
                  )}

                  {currentStep === 'color' && (
                    <RegistrationStep key="color" title={t('select_color_step')} icon={<Palette className="w-6 h-6 text-emerald-600"/>}>
                      <Select value={color} onValueChange={(value) => { setColor(value); setCurrentStep('rfid'); }} required>
                        <SelectTrigger className="bg-white/70 h-12 text-lg">
                          <SelectValue placeholder={t('select_color')} />
                        </SelectTrigger>
                        <SelectContent>
                          {colorOptions.map(c => (
                            <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </RegistrationStep>
                  )}
                  
                  {currentStep === 'rfid' && (
                    <RegistrationStep key="rfid" title={t('scan_plush_rfid_step')} icon={<ScanLine className="w-6 h-6 text-emerald-600"/>}>
                       <Input id="rfid_input" placeholder={t('waiting_rfid_scan')} value={rfidInput} onChange={handleRfidScanChange} autoComplete="off" className="font-mono text-lg h-12" autoFocus />
                    </RegistrationStep>
                  )}

                  {currentStep === 'device' && (
                    <RegistrationStep key="device" title={t('scan_device_id_step')} icon={<Cpu className="w-6 h-6 text-emerald-600"/>}>
                       <Input id="device_input" placeholder={t('device_id_placeholder')} value={deviceId} onChange={handleDeviceIdChange} onKeyDown={handleDeviceIdKeyDown} autoComplete="off" className="font-mono text-lg h-12" autoFocus />
                    </RegistrationStep>
                  )}
                  
                  {currentStep === 'notes' && (
                    <RegistrationStep key="notes" title={t('additional_notes_step')} icon={<Fingerprint className="w-6 h-6 text-emerald-600"/>}>
                      <Textarea id="notes_input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('special_observations_placeholder')} autoFocus />
                       <div className="flex justify-end mt-4">
                         <Button onClick={() => setCurrentStep('submit')}>{t('continue')}</Button>
                       </div>
                    </RegistrationStep>
                  )}

                  {currentStep === 'submit' && (
                     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="submit">
                        <h3 className="text-xl font-semibold text-slate-700 mb-4">{t('confirm_register_step')}</h3>
                        <div className="space-y-3 rounded-lg bg-slate-50 p-4 border mb-6">
                            <div className="flex justify-between"><span className="text-slate-500">{t('version')}:</span><span className="font-semibold">{selectedVersion?.model_name || 'N/A'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">{t('color')}:</span><span className="font-semibold capitalize">{color || 'N/A'}</span></div>
                            <div className="flex justify-between items-center"><span className="text-slate-500">RFID:</span><span className="font-mono text-xs bg-slate-200 px-2 py-1 rounded">{rfid || 'N/A'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">{t('device_id')}:</span><span className="font-mono bg-slate-200 px-2 py-1 rounded">{deviceId || 'N/A'}</span></div>
                            {notes && <div className="pt-2 border-t"><p className="text-slate-500 text-sm italic">"{notes}"</p></div>}
                        </div>
                        
                        <AnimatePresence>
                          {error && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm mb-4">{error.message}</motion.div>}
                          {deviceWarning && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                               <p className="text-sm text-amber-800 mb-3 font-medium">{deviceWarning.message}</p>
                               <div className="flex gap-3">
                                <Button type="button" onClick={handleForceRegister} disabled={isRegistering} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
                                  {isRegistering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                  {t('continue_anyway')}
                                </Button>
                                <Button type="button" variant="outline" onClick={() => setDeviceWarning(null)} disabled={isRegistering} className="border-amber-300 text-amber-700 hover:bg-amber-50">
                                  {t('cancel_and_review')}
                                </Button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <Button onClick={handleQuickRegister} className="w-full h-14 text-lg bg-gradient-to-r from-emerald-600 to-teal-600" disabled={isRegistering || deviceWarning}>
                          {isRegistering ? <Loader2 className="w-6 h-6 mr-2 animate-spin" /> : <><CheckCircle className="w-6 h-6 mr-2" />{t('register_dinosaur')}</>}
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

        <AnimatePresence>
          {lastRegistered && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              onAnimationComplete={() => setTimeout(() => setLastRegistered(null), 3000)}
              className="p-4 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg shadow-md flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5" />
                <p className="font-medium">
                  {t('dinosaur_registered_successfully_rfid')}{' '}
                  <span className="font-mono bg-white/70 px-1 rounded">{lastRegistered.rfid_code}</span>
                  {' '}• {t('device')}{' '}
                  <span className="font-mono bg-white/70 px-1 rounded">{lastRegistered.device_id}</span>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder={t('search_rfid_device_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/50 md:col-span-2"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-white/50">
                <SelectValue placeholder={t('all_statuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_statuses')}</SelectItem>
                <SelectItem value="available">{t('available')}</SelectItem>
                <SelectItem value="sold">{t('sold')}</SelectItem>
                <SelectItem value="maintenance">{t('maintenance')}</SelectItem>
                <SelectItem value="damaged">{t('damaged')}</SelectItem>
                <SelectItem value="unverified">{t('unverified')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={colorFilter} onValueChange={setColorFilter}>
              <SelectTrigger className="bg-white/50">
                <SelectValue placeholder={t('all_colors')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_colors')}</SelectItem>
                <SelectItem value="rosa">{t('pink')}</SelectItem>
                <SelectItem value="teal">{t('teal')}</SelectItem>
                <SelectItem value="lavender">{t('lavender')}</SelectItem>
                <SelectItem value="green">{t('green')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={versionFilter} onValueChange={setVersionFilter}>
              <SelectTrigger className="bg-white/50 md:col-span-2">
                <SelectValue placeholder={t('all_versions')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_versions')}</SelectItem>
                {versions.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.model_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-sm text-slate-600 flex items-center md:col-span-2 justify-end">
              {t('total_dinosaurs', { count: filteredDinosaurs.length })}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <DinosaursList
            dinosaurs={filteredDinosaurs}
            versions={versions}
            onDelete={handleDeleteDinosaur}
            onEdit={handleEditDinosaur}
          />
        </motion.div>
      </div>
    </div>
  );
}
