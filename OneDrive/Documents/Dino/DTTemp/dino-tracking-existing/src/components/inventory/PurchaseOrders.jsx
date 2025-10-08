
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PurchaseOrder } from '@/api/entities';
import { Component } from '@/api/entities';
import { useLanguage } from '@/components/LanguageProvider';
import { useWarehouse } from '@/components/WarehouseProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Plus, ShoppingCart, Loader2, Edit, Trash2 } from 'lucide-react';
import CreatePurchaseOrderForm from '@/components/inventory/CreatePurchaseOrderForm';

const statusStyles = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  partially_received: 'bg-blue-100 text-blue-800 border-blue-200',
  in_transit: 'bg-purple-100 text-purple-800 border-purple-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
};

export default function PurchaseOrders() {
  const { t, language } = useLanguage();
  const { activeWarehouse, filterByWarehouse } = useWarehouse();
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [components, setComponents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPO, setEditingPO] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [pos, comps] = await Promise.all([
        PurchaseOrder.list('-order_date'),
        Component.list('name'),
      ]);
      
      // Filter by active warehouse
      const filteredPOs = filterByWarehouse(pos);
      const filteredComps = filterByWarehouse(comps);
      
      setPurchaseOrders(filteredPOs);
      setComponents(filteredComps);
    } catch (error) {
      console.error("Error loading purchase order data:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (activeWarehouse) {
      loadData();
    } else {
      setPurchaseOrders([]); // Clear POs if no warehouse is selected
      setComponents([]); // Clear components if no warehouse is selected
      setIsLoading(false); // No loading if no warehouse selected
    }
  }, [activeWarehouse]);

  const handleFormClose = () => {
    setShowCreateForm(false);
    setEditingPO(null);
    loadData(); // Refresh list after creating/editing
  };

  const handleEditPO = (po) => {
    setEditingPO(po);
    setShowCreateForm(true);
  };

  const handleDeletePO = async (po) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar la PO ${po.po_number}? Esta acción no se puede deshacer.`)) {
      try {
        await PurchaseOrder.delete(po.id);
        loadData(); // Refresh list
      } catch (error) {
        console.error("Error deleting PO:", error);
        alert('Error al eliminar la PO: ' + error.message);
      }
    }
  };
  
  if (!activeWarehouse) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <ShoppingCart className="mx-auto h-12 w-12 text-slate-400 mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">
            {t('select_warehouse')}
          </h3>
          <p className="text-sm text-slate-600">
            Please select a warehouse to view purchase orders
          </p>
        </CardContent>
      </Card>
    );
  }
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-10">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('purchase_orders')}</CardTitle>
          <CardDescription>{t('create_and_manage_pos')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="mr-2 h-4 w-4" /> {t('create_po')}
          </Button>
        </CardContent>
      </Card>
      
      <AnimatePresence>
        {showCreateForm && (
          <CreatePurchaseOrderForm
            po={editingPO}
            components={components}
            onClose={handleFormClose}
          />
        )}
      </AnimatePresence>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {purchaseOrders.map(po => {
          const poTotal = po.items?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;
          
          return (
            <motion.div key={po.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="flex flex-col h-full">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{po.po_number}</CardTitle>
                      <CardDescription>{po.supplier_name}</CardDescription>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${statusStyles[po.status]}`}>
                      {t(po.status) || po.status}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow">
                  <ul className="text-sm space-y-2 text-slate-700">
                    {po.items.slice(0, 3).map(item => (
                      <li key={item.component_id} className="border-b border-slate-100 pb-2 last:border-0">
                        <div className="flex justify-between items-start">
                          <span className="flex-1 font-medium">{item.component_name}</span>
                          <div className="text-right ml-2">
                            <div className="font-mono text-xs">{item.quantity_received}/{item.quantity_ordered}</div>
                            {item.total_price > 0 && (
                              <div className="text-xs text-green-600 font-semibold">
                                ${item.total_price.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                        {item.batch_info && (
                          <p className="text-xs text-slate-500 mt-1 font-mono bg-slate-50 px-2 py-1 rounded inline-block">
                            {t('batch_info')}: {item.batch_info}
                          </p>
                        )}
                      </li>
                    ))}
                    {po.items.length > 3 && (
                      <li className="text-xs text-slate-500 text-center pt-1">
                        ... {t('and')} {po.items.length - 3} {t('more_items')}
                      </li>
                    )}
                  </ul>
                  
                  {poTotal > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-slate-700">{t('total')}:</span>
                        <span className="text-lg font-bold text-green-600">
                          ${poTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                  <div className="text-xs text-slate-500 w-full">
                    <span>{t('ordered_on')}: {new Date(po.order_date).toLocaleDateString(language)}</span>
                  </div>
                  <div className="flex gap-2 w-full">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleEditPO(po)}
                      className="flex-1 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      {t('edit')}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDeletePO(po)}
                      className="flex-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      {t('delete')}
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </motion.div>
          );
        })}
      </div>
      
      {purchaseOrders.length === 0 && (
        <div className="text-center p-10 border-2 border-dashed rounded-lg">
          <ShoppingCart className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">{t('no_pos_found')}</h3>
          <p className="mt-1 text-sm text-slate-500">{t('create_first_po')}</p>
        </div>
      )}
    </div>
  );
}
