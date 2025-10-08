import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/components/LanguageProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Save, Shield } from 'lucide-react';

const allPermissions = [
    'dashboard', 'components', 'versions', 'dinosaurs', 'devices',
    'inventory_management', 'quality_control', 'sales', 'search',
    'operator_management', 'wip_loading', 'shipping'
];

export default function OperatorForm({ operator, isCreatingNew, onSave, onCancel }) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState(
    operator || {
      name: '',
      code: '',
      description: '',
      is_admin: false,
      permissions: [],
    }
  );

  const handleTextChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAdminChange = (checked) => {
    if (checked) {
      setFormData(prev => ({ 
        ...prev, 
        is_admin: true,
        permissions: [...allPermissions] 
      }));
    } else {
      setFormData(prev => ({ ...prev, is_admin: false }));
    }
  };

  const handlePermissionChange = (permission, checked) => {
    setFormData(prev => {
      const currentPermissions = prev.permissions || [];
      if (checked) {
        return { ...prev, permissions: [...currentPermissions, permission] };
      } else {
        const newPermissions = currentPermissions.filter(p => p !== permission);
        return { 
          ...prev, 
          permissions: newPermissions,
          is_admin: newPermissions.length === allPermissions.length ? prev.is_admin : false
        };
      }
    });
  };

  const handleSave = () => {
    if (!formData.code || formData.code.trim().length === 0) {
        alert('El código de acceso es requerido');
        return;
    }
    onSave(formData);
  };
  
  const title = isCreatingNew ? t('add_operator') : t('edit_operator_for', { name: operator?.name });
  const description = isCreatingNew ? t('add_operator_desc') : t('edit_operator_desc');

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="mb-8"
    >
      <Card className="bg-white/90">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">{t('operator_name')}</Label>
              <Input id="name" value={formData.name} onChange={e => handleTextChange('name', e.target.value)} placeholder="Ej: Juan Pérez" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Código de Acceso</Label>
              <Input 
                id="code" 
                value={formData.code} 
                onChange={e => handleTextChange('code', e.target.value.toUpperCase())} 
                placeholder="Ej: JUAN01, 1234, ABC123" 
                className="font-mono text-lg uppercase"
              />
              <p className="text-xs text-slate-500">Puede contener letras y números</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t('description')}</Label>
            <Textarea id="description" value={formData.description} onChange={e => handleTextChange('description', e.target.value)} placeholder={t('operator_role_description_placeholder')} />
          </div>

          {/* Administrator Flag */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="is_admin"
                checked={formData.is_admin}
                onCheckedChange={handleAdminChange}
              />
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-600" />
                <label htmlFor="is_admin" className="text-sm font-semibold text-amber-900 cursor-pointer">
                  {t('administrator')}
                </label>
              </div>
            </div>
            <p className="text-xs text-amber-700 mt-2 ml-8">
              {t('administrator_description')}
            </p>
          </div>

          <div className="space-y-3">
            <Label>{t('access_permissions')}</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 rounded-lg border p-4">
              {allPermissions.map(permission => (
                <div key={permission} className="flex items-center space-x-2">
                  <Checkbox
                    id={`perm-${permission}`}
                    checked={(formData.permissions || []).includes(permission)}
                    onCheckedChange={(checked) => handlePermissionChange(permission, checked)}
                    disabled={formData.is_admin}
                  />
                  <label htmlFor={`perm-${permission}`} className={`text-sm font-medium leading-none capitalize ${formData.is_admin ? 'text-slate-400' : 'cursor-pointer'}`}>
                    {t(permission)}
                  </label>
                </div>
              ))}
            </div>
            {formData.is_admin && (
              <p className="text-xs text-slate-500 italic">
                {t('admin_has_all_permissions')}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>{t('cancel')}</Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            {t('save_changes')}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}