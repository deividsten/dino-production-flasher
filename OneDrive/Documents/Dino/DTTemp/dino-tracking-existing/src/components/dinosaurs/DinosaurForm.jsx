
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/components/LanguageProvider';
import { useWarehouse } from '@/components/WarehouseProvider'; // New import for warehouse context
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { X, Save } from 'lucide-react';

export default function DinosaurForm({ dinosaur, versions, onSave, onClose }) { // Changed onCancel to onClose
  const { t } = useLanguage();
  const { activeWarehouse } = useWarehouse(); // New hook usage to get active warehouse
  const [formData, setFormData] = useState(dinosaur);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // Prepare the data to be saved.
    // If warehouse_id is not already part of the formData (e.g., for a new entity or if it was unset),
    // and an activeWarehouse is available, add its ID to the data.
    // This addresses the "warehouse_id not being saved on creation" while preserving existing edit functionality.
    const dataToSave = { ...formData };
    if (!dataToSave.warehouse_id && activeWarehouse) {
      dataToSave.warehouse_id = activeWarehouse.id;
    }

    // Pass the potentially updated formData to the onSave prop.
    // The parent component is responsible for validation and API calls (create/update).
    onSave(dataToSave);
  };

  const colorOptions = versions.find(v => v.id === formData.version_id)?.available_colors || ["rosa", "teal", "lavender", "green"];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose} // Changed from onCancel
    >
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl"
      >
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{t('edit_dinosaur')}</CardTitle>
              <Button variant="ghost" size="icon" onClick={onClose}> {/* Changed from onCancel */}
                <X className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="rfid_code">RFID</Label>
                <Input id="rfid_code" value={formData.rfid_code} disabled className="font-mono bg-slate-100" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="device_id">{t('device_id')}</Label>
                <Input id="device_id" value={formData.device_id} onChange={e => handleChange('device_id', e.target.value)} className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="version_id">{t('version')}</Label>
                <Select value={formData.version_id} onValueChange={value => handleChange('version_id', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {versions.map(v => <SelectItem key={v.id} value={v.id}>{v.model_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">{t('color')}</Label>
                <Select value={formData.color} onValueChange={value => handleChange('color', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {colorOptions.map(c => <SelectItem key={c} value={c} className="capitalize">{t(`color_${c}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">{t('status')}</Label>
                <Select value={formData.status} onValueChange={value => handleChange('status', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">{t('available')}</SelectItem>
                    <SelectItem value="sold">{t('sold')}</SelectItem>
                    <SelectItem value="maintenance">{t('maintenance')}</SelectItem>
                    <SelectItem value="damaged">{t('damaged')}</SelectItem>
                    <SelectItem value="unverified">{t('unverified')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">{t('notes')}</Label>
              <Textarea id="notes" value={formData.notes} onChange={e => handleChange('notes', e.target.value)} placeholder={t('special_observations_placeholder')} />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>{t('cancel')}</Button> {/* Changed from onCancel */}
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              {t('save_changes')}
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </motion.div>
  );
}
