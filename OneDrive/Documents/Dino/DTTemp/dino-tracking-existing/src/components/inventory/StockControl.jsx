import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Component } from '@/api/entities';
import { useLanguage } from '@/components/LanguageProvider';
import { useWarehouse } from '@/components/WarehouseProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Package, AlertTriangle, CheckCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function StockControl() {
  const { t } = useLanguage();
  const { activeWarehouse, filterByWarehouse } = useWarehouse();
  const [components, setComponents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const lowStockThreshold = 10;

  useEffect(() => {
    const loadComponents = async () => {
      if (!activeWarehouse) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      try {
        const comps = await Component.list('-created_date');
        const filtered = filterByWarehouse(comps);
        setComponents(filtered);
      } catch (error) {
        console.error("Error loading components:", error);
      }
      setIsLoading(false);
    };
    loadComponents();
  }, [activeWarehouse, filterByWarehouse]);

  const filteredComponents = components.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!activeWarehouse) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <Package className="mx-auto h-12 w-12 text-slate-400 mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">
            {t('select_warehouse')}
          </h3>
          <p className="text-sm text-slate-600">
            Please select a warehouse to view stock levels
          </p>
        </CardContent>
      </Card>
    );
  }
  
  if (isLoading) {
    return <div className="flex justify-center items-center p-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('stock_control')}</CardTitle>
          <CardDescription>{t('view_current_inventory_levels')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder={t('search_components_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredComponents.map(component => {
          const isLowStock = component.quantity < lowStockThreshold;
          const isOutOfStock = component.quantity === 0;
          return (
            <motion.div key={component.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-md font-bold">{component.name}</CardTitle>
                    {isOutOfStock ? (
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    ) : isLowStock ? (
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                  </div>
                  <CardDescription>{component.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">{t('current_stock')}:</span>
                    <Badge className={
                      isOutOfStock ? 'bg-red-100 text-red-800' :
                      isLowStock ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }>
                      {component.quantity} {t('units')}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-slate-600">{t('tracking')}:</span>
                    <Badge variant="outline">{t(component.tracking_type)}</Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
      {filteredComponents.length === 0 && (
         <div className="text-center p-10 border-2 border-dashed rounded-lg">
            <Package className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-2 text-sm font-medium text-slate-900">{t('no_components_found')}</h3>
          </div>
      )}
    </div>
  );
}