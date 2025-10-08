import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DinosaurVersion, Component } from '@/api/entities';
import { useLanguage } from '@/components/LanguageProvider';
import { useWarehouse } from '@/components/WarehouseProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Layers, CheckCircle, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ProductionPlan() {
  const { t } = useLanguage();
  const { activeWarehouse, filterByWarehouse } = useWarehouse();
  const [versions, setVersions] = useState([]);
  const [components, setComponents] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [productionCapacity, setProductionCapacity] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!activeWarehouse) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      try {
        const [vers, comps] = await Promise.all([
          DinosaurVersion.list(),
          Component.list(),
        ]);
        
        // Filter components by warehouse
        const filteredComps = filterByWarehouse(comps);
        
        setVersions(vers);
        setComponents(filteredComps);
        if (vers.length > 0) {
          setSelectedVersionId(vers[0].id);
        }
      } catch (error) {
        console.error("Error loading production plan data:", error);
      }
      setIsLoading(false);
    };
    loadData();
  }, [activeWarehouse, filterByWarehouse]);

  useEffect(() => {
    if (selectedVersionId && versions.length > 0 && components.length > 0) {
      calculateCapacity();
    }
  }, [selectedVersionId, versions, components]);

  const calculateCapacity = () => {
    const version = versions.find(v => v.id === selectedVersionId);
    if (!version || !version.components || version.components.length === 0) {
      setProductionCapacity({ canProduce: 0, shortages: [] });
      return;
    }

    let maxCanProduce = Infinity;
    const shortages = [];
    const componentMap = new Map(components.map(c => [c.id, c.quantity]));

    version.components.forEach(req => {
      const available = componentMap.get(req.component_id) || 0;
      const canProduceFromThis = Math.floor(available / 1);
      maxCanProduce = Math.min(maxCanProduce, canProduceFromThis);
      
      if (available < 1) {
        shortages.push({ name: req.component_name, needed: 1, available });
      }
    });

    setProductionCapacity({
      canProduce: maxCanProduce === Infinity ? 0 : maxCanProduce,
      shortages: shortages
    });
  };

  if (!activeWarehouse) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <Layers className="mx-auto h-12 w-12 text-slate-400 mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">
            {t('select_warehouse')}
          </h3>
          <p className="text-sm text-slate-600">
            Please select a warehouse to view production capacity
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <div className="flex justify-center items-center p-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  }

  const selectedVersion = versions.find(v => v.id === selectedVersionId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('production_plan')}</CardTitle>
          <CardDescription>{t('plan_dinosaur_production')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedVersionId || ''} onValueChange={setSelectedVersionId}>
            <SelectTrigger className="w-full md:w-1/2">
              <SelectValue placeholder={t('select_version')} />
            </SelectTrigger>
            <SelectContent>
              {versions.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.model_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedVersion && productionCapacity !== null && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardHeader>
              <CardTitle>{t('production_capacity_for')} {selectedVersion.model_name}</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-7xl font-bold text-indigo-600">{productionCapacity.canProduce}</p>
              <p className="text-xl text-slate-600">{t('dinosaurs_can_be_produced')}</p>
            </CardContent>
          </Card>
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>{t('component_status')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {selectedVersion.components.map(req => {
                   const available = components.find(c => c.id === req.component_id)?.quantity || 0;
                   const canProduce = Math.floor(available / 1);
                  return (
                    <div key={req.component_id} className="p-3 border rounded-lg flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{req.component_name}</p>
                        <p className="text-sm">{t('stock')}: {available}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {canProduce > 0 ? (
                           <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                           <AlertTriangle className="h-5 w-5 text-red-500" />
                        )}
                        <span className="font-medium">{t('sufficient_for')} {canProduce} {t('units')}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {!selectedVersion && (
         <div className="text-center p-10 border-2 border-dashed rounded-lg">
            <Layers className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-2 text-sm font-medium text-slate-900">{t('no_version_selected')}</h3>
            <p className="mt-1 text-sm text-slate-500">{t('select_version_to_see_plan')}</p>
        </div>
      )}
    </div>
  );
}