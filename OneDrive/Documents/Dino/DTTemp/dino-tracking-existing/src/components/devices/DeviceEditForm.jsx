import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Device } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { X, Save, Cpu, ScanLine } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

export default function DeviceEditForm({ device, versions, onSave, onCancel }) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    ...device,
    serial_inputs: device.components_used?.reduce((acc, comp) => {
      if (comp.tracking_type === 'unidad' && comp.serial_number) {
        acc[comp.component_id] = comp.serial_number;
      }
      return acc;
    }, {}) || {}
  });

  const [isSaving, setIsSaving] = useState(false);
  const serialInputRefs = useRef({});

  const selectedVersion = versions.find(v => v.id === formData.version_id);
  const versionBom = selectedVersion?.components || [];
  const unitComponents = versionBom.filter(c => c.tracking_type === 'unidad');

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSerialChange = (componentId, value) => {
    setFormData(prev => ({
      ...prev,
      serial_inputs: {
        ...prev.serial_inputs,
        [componentId]: value
      }
    }));
  };

  const handleSerialKeyDown = (e, currentIndex) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextIndex = currentIndex + 1;
      
      if (nextIndex < unitComponents.length) {
        const nextComponentId = unitComponents[nextIndex].component_id;
        serialInputRefs.current[nextComponentId]?.focus();
      }
    }
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

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Update components_used with new serial numbers
      const updatedComponentsUsed = formData.components_used.map(comp => {
        if (comp.tracking_type === 'unidad') {
          return {
            ...comp,
            serial_number: formData.serial_inputs[comp.component_id] || comp.serial_number
          };
        }
        return comp;
      });

      const currentOperator = getCurrentOperator();

      const updatedData = {
        device_id: formData.device_id,
        version_id: formData.version_id,
        status: formData.status,
        notes: formData.notes,
        components_used: updatedComponentsUsed,
        assembly_date: new Date().toISOString(), // Update to current date/time
        assembled_by_operator: currentOperator?.name || formData.assembled_by_operator || 'Desconocido'
      };

      await Device.update(device.id, updatedData);
      onSave({ ...device, ...updatedData });
    } catch (error) {
      console.error('Error updating device:', error);
      alert('Error al actualizar el dispositivo: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <Card className="border-0 shadow-2xl">
          <CardHeader className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Cpu className="w-6 h-6" />
                <CardTitle className="text-xl">Editar Dispositivo</CardTitle>
              </div>
              <Button variant="ghost" size="icon" onClick={onCancel} className="text-white hover:bg-white/20">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="device_id">Device ID</Label>
                <Input 
                  id="device_id" 
                  value={formData.device_id} 
                  onChange={e => handleChange('device_id', e.target.value)} 
                  className="font-mono" 
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select value={formData.status} onValueChange={value => handleChange('status', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ready">Listo</SelectItem>
                    <SelectItem value="used">Usado</SelectItem>
                    <SelectItem value="defective">Defectuoso</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="version_id">Versión</Label>
                <Select value={formData.version_id} onValueChange={value => handleChange('version_id', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.model_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Serial Numbers for Unit-tracked Components */}
            {unitComponents.length > 0 && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">Números de Serie de Componentes</Label>
                <div className="space-y-3 rounded-lg bg-slate-50 p-4 border">
                  {unitComponents.map((comp, index) => (
                    <div key={comp.component_id} className="grid grid-cols-1 sm:grid-cols-3 items-center gap-3">
                      <Label className="sm:col-span-1 text-sm">{comp.component_name}</Label>
                      <div className="relative sm:col-span-2">
                        <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input 
                          ref={el => serialInputRefs.current[comp.component_id] = el}
                          value={formData.serial_inputs[comp.component_id] || ""} 
                          onChange={e => handleSerialChange(comp.component_id, e.target.value)} 
                          onKeyDown={(e) => handleSerialKeyDown(e, index)}
                          placeholder="Escanear número de serie..." 
                          className="font-mono pl-10 bg-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea 
                id="notes" 
                value={formData.notes || ''} 
                onChange={e => handleChange('notes', e.target.value)} 
                placeholder="Notas sobre el dispositivo..."
                rows={4}
              />
            </div>

            {/* Original Assembly Date Info */}
            {device.assembly_date && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Fecha de ensamblaje original:</strong> {new Date(device.assembly_date).toLocaleString('es-ES')}
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Al guardar, se actualizará a la fecha actual de edición
                </p>
              </div>
            )}
          </CardContent>
          
          <CardFooter className="flex justify-end gap-3 p-6 bg-slate-50">
            <Button variant="outline" onClick={onCancel} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-gradient-to-r from-purple-600 to-indigo-600">
              {isSaving ? (
                <>Guardando...</>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </motion.div>
  );
}