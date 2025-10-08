import React, { useState } from 'react';
import { useWarehouse } from '@/components/WarehouseProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Warehouse as WarehouseIcon, Plus, Edit, Trash2, MapPin, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/components/LanguageProvider';

export default function WarehouseManagement() {
  const { t } = useLanguage();
  const { warehouses, activeWarehouse, createWarehouse, updateWarehouse, deleteWarehouse, loadWarehouses } = useWarehouse();
  const [showForm, setShowForm] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    location: '',
    is_active: true
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingWarehouse) {
        await updateWarehouse(editingWarehouse.id, formData);
      } else {
        await createWarehouse(formData);
      }
      setShowForm(false);
      setEditingWarehouse(null);
      setFormData({ name: '', code: '', description: '', location: '', is_active: true });
    } catch (error) {
      console.error('Error saving warehouse:', error);
      alert('Error: ' + error.message);
    }
  };

  const handleEdit = (warehouse) => {
    setEditingWarehouse(warehouse);
    setFormData(warehouse);
    setShowForm(true);
  };

  const handleDelete = async (warehouse) => {
    if (warehouse.id === activeWarehouse?.id) {
      alert('No puedes eliminar el warehouse activo. Cambia a otro warehouse primero.');
      return;
    }
    if (window.confirm(`¿Eliminar warehouse "${warehouse.name}"?`)) {
      await deleteWarehouse(warehouse.id);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <WarehouseIcon className="w-8 h-8 text-purple-600" />
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  Warehouse Management
                </h1>
                <p className="text-slate-600">Gestiona múltiples ubicaciones/almacenes</p>
              </div>
            </div>
            <Button onClick={() => { setShowForm(true); setEditingWarehouse(null); setFormData({ name: '', code: '', description: '', location: '', is_active: true }); }} className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-5 h-5 mr-2" />
              Nuevo Warehouse
            </Button>
          </div>
        </motion.div>

        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>{editingWarehouse ? 'Editar' : 'Crear'} Warehouse</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Nombre *</Label>
                        <Input id="name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="ej: Warehouse Principal" required />
                      </div>
                      <div>
                        <Label htmlFor="code">Código *</Label>
                        <Input id="code" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} placeholder="ej: MEX-01" required className="uppercase" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="location">Ubicación</Label>
                      <Input id="location" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="ej: Ciudad de México, México" />
                    </div>
                    <div>
                      <Label htmlFor="description">Descripción</Label>
                      <Textarea id="description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Descripción del warehouse..." />
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingWarehouse(null); }}>
                        Cancelar
                      </Button>
                      <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
                        {editingWarehouse ? 'Actualizar' : 'Crear'} Warehouse
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {warehouses.map((warehouse, index) => (
            <motion.div key={warehouse.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
              <Card className={`hover:shadow-xl transition-all ${warehouse.id === activeWarehouse?.id ? 'ring-2 ring-purple-500' : ''}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg">{warehouse.name}</CardTitle>
                        {warehouse.id === activeWarehouse?.id && (
                          <Badge className="bg-purple-100 text-purple-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Activo
                          </Badge>
                        )}
                      </div>
                      <Badge variant="outline" className="font-mono">{warehouse.code}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {warehouse.location && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <MapPin className="w-4 h-4" />
                      {warehouse.location}
                    </div>
                  )}
                  {warehouse.description && (
                    <p className="text-sm text-slate-600">{warehouse.description}</p>
                  )}
                  <div className="flex gap-2 pt-3">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(warehouse)} className="flex-1">
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(warehouse)} className="text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {warehouses.length === 0 && (
          <Card className="p-12 text-center">
            <WarehouseIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-600 mb-2">No hay warehouses</h3>
            <p className="text-slate-500 mb-4">Crea tu primer warehouse para comenzar</p>
            <Button onClick={() => setShowForm(true)} className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-5 h-5 mr-2" />
              Crear Primer Warehouse
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}