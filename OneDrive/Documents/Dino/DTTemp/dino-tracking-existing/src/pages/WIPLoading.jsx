
import React, { useState, useEffect } from 'react';
import { WIPLoading as WIPLoadingEntity, DinosaurVersion, Component, PurchaseOrder } from '@/api/entities';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ClipboardList, CheckCircle, Loader2, Package, Link as LinkIcon, AlertTriangle, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { useWarehouse } from "@/components/WarehouseProvider";

export default function WIPLoadingPage() {
  const { t } = useLanguage();
  const { activeWarehouse } = useWarehouse();
  const [todayWIP, setTodayWIP] = useState(null);
  const [versions, setVersions] = useState([]);
  const [components, setComponents] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [loadedBins, setLoadedBins] = useState([]);
  const [selectedComponentId, setSelectedComponentId] = useState(null);
  const [binInput, setBinInput] = useState('');
  const [selectedPOId, setSelectedPOId] = useState('');
  const [poScanInput, setPOScanInput] = useState(''); // New state for PO scan input
  const [quantityToLoad, setQuantityToLoad] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isCompletingWIP, setIsCompletingWIP] = useState(false);

  useEffect(() => {
    if (activeWarehouse) {
      loadData();
    }
  }, [activeWarehouse]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [versionsData, componentsData, wipsData, posData] = await Promise.all([
        DinosaurVersion.list('-created_date'),
        Component.list(),
        WIPLoadingEntity.list('-created_date'),
        PurchaseOrder.list('-order_date')
      ]);

      setVersions(versionsData);
      setComponents(componentsData);
      
      // CRITICAL: Filter POs by active warehouse
      const warehousePOs = posData.filter(po => po.warehouse_id === activeWarehouse?.id);
      setPurchaseOrders(warehousePOs);
      
      const warehouseWIPs = wipsData.filter(w => w.warehouse_id === activeWarehouse?.id);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const foundTodayWIP = warehouseWIPs.find(w => {
        if (w.status !== 'active') return false;
        
        const wipDateStr = w.created_at || w.created_date;
        if (!wipDateStr) return false;
        
        try {
          const wipDate = new Date(wipDateStr);
          if (isNaN(wipDate.getTime())) return false;
          
          wipDate.setHours(0, 0, 0, 0);
          return wipDate.getTime() === today.getTime();
        } catch (error) {
          return false;
        }
      });
      
      setTodayWIP(foundTodayWIP);
    } catch (error) {
      console.error('Error loading WIP data:', error);
    }
    setIsLoading(false);
  };

  const handleCompleteWIP = async () => {
    if (!todayWIP) return;

    setIsCompletingWIP(true);
    try {
      await WIPLoadingEntity.update(todayWIP.id, { status: 'completed' });
      await loadData();
    } catch (error) {
      console.error('Error completing WIP:', error);
      alert(t('error_completing_wip') + ' ' + error.message);
    }
    setIsCompletingWIP(false);
  };

  const getRequiredComponents = () => {
    const version = versions.find(v => v.id === selectedVersionId);
    return version?.components?.filter(c => c.tracking_type === 'lote') || [];
  };

  const getComponentDetails = (componentId) => {
    return components.find(c => c.id === componentId);
  };

  const getLoadedBinsForComponent = (componentId) => {
    return loadedBins.filter(b => b.component_id === componentId);
  };

  const isComponentFullyLoaded = (componentId) => {
    const bins = getLoadedBinsForComponent(componentId);
    return bins.length > 0;
  };

  const getAvailablePOsForComponent = (componentId) => {
    // CRITICAL: Only show POs from the active warehouse
    return purchaseOrders.filter(po => {
      // Double check warehouse match
      if (po.warehouse_id !== activeWarehouse?.id) return false;
      
      if (po.status === 'completed' || po.status === 'cancelled') return false;
      
      const item = po.items?.find(i => i.component_id === componentId);
      if (!item) return false;
      
      const remaining = item.quantity_ordered - (item.quantity_received || 0);
      return remaining > 0;
    });
  };

  const handlePOScan = (scannedValue) => {
    if (!scannedValue.trim()) return;
    
    // availablePOs is already filtered by the selected component
    const po = availablePOs.find(p => p.po_number.toLowerCase() === scannedValue.trim().toLowerCase());
    if (po) {
      setSelectedPOId(po.id);
      setPOScanInput('');
    } else {
      alert(t('po_not_found_or_unavailable', { scannedValue: scannedValue }));
      setPOScanInput('');
    }
  };

  const handleLinkBin = () => {
    if (!binInput.trim()) {
      alert(t('bin_number_placeholder'));
      return;
    }

    if (!selectedPOId) {
      alert(t('select_purchase_order'));
      return;
    }

    const qtyToLoad = parseInt(quantityToLoad);
    if (!qtyToLoad || qtyToLoad <= 0) {
      alert(t('quantity_to_load_placeholder'));
      return;
    }

    const selectedComponent = getComponentDetails(selectedComponentId);
    if (!selectedComponent) return;

    // CRITICAL: Check if component already has a bin loaded
    const existingBin = loadedBins.find(b => b.component_id === selectedComponentId);
    
    if (existingBin) {
      // Ask for confirmation to replace
      const confirmReplace = window.confirm(
        t('replace_existing_bin_warning', {
          componentName: existingBin.component_name,
          existingBin: existingBin.bin_number,
          quantity: existingBin.quantity_loaded,
          poNumber: existingBin.po_number,
          newBin: binInput.trim()
        })
      );
      
      if (!confirmReplace) {
        // User cancelled, don't proceed
        return;
      }
      
      // User confirmed, remove existing bin
      setLoadedBins(loadedBins.filter(b => b.component_id !== selectedComponentId));
    }

    const selectedPO = purchaseOrders.find(po => po.id === selectedPOId);
    const poItem = selectedPO?.items?.find(i => i.component_id === selectedComponent.id);
    
    if (!poItem) {
      alert('Error: Item not found in PO');
      return;
    }

    const availableQty = poItem.quantity_ordered - (poItem.quantity_received || 0);

    if (qtyToLoad > availableQty) {
      alert(t('only_x_units_available_in_po', { availableQty: availableQty }));
      return;
    }

    const newBin = {
      component_id: selectedComponent.id,
      component_name: selectedComponent.name,
      bin_number: binInput.trim(),
      po_id: selectedPO.id,
      po_number: selectedPO.po_number,
      quantity_loaded: qtyToLoad,
      quantity_consumed: 0
    };

    setLoadedBins(prevBins => [...prevBins.filter(b => b.component_id !== selectedComponentId), newBin]);
    setBinInput('');
    setSelectedPOId('');
    setPOScanInput(''); // Clear PO scan input
    setQuantityToLoad('');
    
    if (existingBin) {
      alert(t('bin_replaced_successfully'));
    } else {
      alert(t('bin_linked_successfully'));
    }
  };

  const handleCreateWIPLoading = async () => {
    if (!selectedVersionId) {
      alert(t('please_select_version'));
      return;
    }

    if (!activeWarehouse) {
      alert('Por favor selecciona un warehouse');
      return;
    }

    const required = getRequiredComponents();
    if (loadedBins.length < required.length) {
      alert(t('please_scan_all_batches'));
      return;
    }

    setIsCreating(true);
    try {
      const operator = JSON.parse(localStorage.getItem('dinotrack-operator') || '{}');

      const wipData = {
        warehouse_id: activeWarehouse.id,
        version_id: selectedVersionId,
        bins_loaded: loadedBins,
        status: 'active',
        created_at: new Date().toISOString(),
        created_by_operator: operator.name || 'Unknown'
      };

      const createdWIP = await WIPLoadingEntity.create(wipData);

      // Now update Components to add the bins and link to POs
      for (const bin of loadedBins) {
        const component = await Component.get(bin.component_id);
        
        const newBin = {
          bin_number: bin.bin_number,
          po_id: bin.po_id,
          description: `From PO ${bin.po_number}`,
          quantity: bin.quantity_loaded,
          created_date: new Date().toISOString()
        };

        const updatedBins = [...(component.bins || []), newBin];
        const updatedQuantity = (component.quantity || 0) + bin.quantity_loaded;

        await Component.update(component.id, {
          bins: updatedBins,
          quantity: updatedQuantity
        });

        // Update PO item as received
        const po = await PurchaseOrder.get(bin.po_id);
        const updatedItems = po.items.map(item => 
          item.component_id === bin.component_id
            ? { ...item, quantity_received: (item.quantity_received || 0) + bin.quantity_loaded }
            : item
        );

        const allReceived = updatedItems.every(i => i.quantity_received >= i.quantity_ordered);
        await PurchaseOrder.update(po.id, {
          items: updatedItems,
          status: allReceived ? 'completed' : 'partially_received'
        });
      }

      await loadData();
      setSelectedVersionId('');
      setLoadedBins([]);
      setSelectedComponentId(null);
      setSelectedPOId(''); // Clear selected PO
      setPOScanInput(''); // Clear PO scan input
    } catch (error) {
      console.error(t('error_creating_wip'), error);
      alert(t('error_creating_wip') + ' ' + error.message);
    }
    setIsCreating(false);
  };

  const requiredComponents = getRequiredComponents();
  const selectedComponent = selectedComponentId ? getComponentDetails(selectedComponentId) : null;
  const availablePOs = selectedComponent ? getAvailablePOsForComponent(selectedComponent.id) : [];
  const selectedComponentBins = selectedComponentId ? getLoadedBinsForComponent(selectedComponentId) : [];
  const allBinsLoaded = requiredComponents.every(rc => isComponentFullyLoaded(rc.component_id));

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-2">
            <ClipboardList className="w-8 h-8 text-indigo-600" />
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {t('wip_loading_station')}
              </h1>
              <p className="text-slate-600">{t('wip_loading_subtitle')}</p>
            </div>
          </div>
        </motion.div>

        {/* Active WIP Display */}
        {todayWIP && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                    <div>
                      <h3 className="text-xl font-bold text-green-800">
                        {t('active_wip_today')}
                      </h3>
                      <p className="text-sm text-green-600">
                        {versions.find(v => v.id === todayWIP.version_id)?.model_name || 'N/A'}
                      </p>
                      <p className="text-xs text-green-500 mt-1">
                        {t('loaded_by')}: {todayWIP.created_by_operator || 'N/A'}
                      </p>
                    </div>
                  </div>
                  
                  {todayWIP.status === 'active' && (
                    <Button
                      onClick={handleCompleteWIP}
                      variant="outline"
                      className="border-green-600 text-green-700 hover:bg-green-100"
                      disabled={isCompletingWIP}
                    >
                      {isCompletingWIP ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {t('completing_wip')}
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          {t('complete_wip')}
                        </>
                      )}
                    </Button>
                  )}
                </div>

                <div className="mt-4 p-4 bg-white/70 rounded-lg">
                  <p className="text-sm font-semibold text-gray-700 mb-2">{t('bins_loaded')}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {todayWIP.bins_loaded?.map((bin, idx) => (
                      <div key={idx} className="p-3 rounded-lg border-2 bg-green-50 border-green-300">
                        <p className="text-sm font-medium text-gray-800">{bin.component_name}</p>
                        <p className="text-xs text-gray-600 font-mono">{bin.bin_number}</p>
                        <p className="text-xs text-gray-500 mt-1">{t('linked_to_po')}: {bin.po_number}</p>
                        <p className="text-sm font-bold text-green-700 mt-1">
                          {bin.quantity_loaded} {t('units')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Create New WIP Loading */}
        {!todayWIP && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            <Card className="bg-white shadow-xl border-2 border-indigo-200">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-indigo-600" />
                  {t('create_wip_loading_today')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Step 1: Select Version */}
                <div>
                  <Label className="block text-sm font-medium text-slate-700 mb-2">
                    {t('version_to_assemble')}
                  </Label>
                  <Select value={selectedVersionId} onValueChange={(val) => {
                    setSelectedVersionId(val);
                    setLoadedBins([]);
                    setSelectedComponentId(null);
                    setBinInput('');
                    setSelectedPOId('');
                    setPOScanInput(''); // Clear PO scan input
                    setQuantityToLoad('');
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_version_placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {versions.map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.model_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Step 2: Load Bins - Two Column Layout */}
                {selectedVersionId && requiredComponents.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                      <span className="font-semibold text-indigo-900">
                        {t('bins_to_load')}: {loadedBins.length} / {requiredComponents.length}
                      </span>
                      <Badge className={allBinsLoaded ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                        {allBinsLoaded ? t('all_scanned') : t('pending')}
                      </Badge>
                    </div>

                    {/* Two Column Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left Column - Components List */}
                      <div className="lg:col-span-1">
                        <Card className="border-2 border-indigo-200">
                          <CardHeader className="bg-indigo-50">
                            <CardTitle className="text-lg">{t('components_to_load')}</CardTitle>
                          </CardHeader>
                          <CardContent className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
                            {requiredComponents.map(reqComp => {
                              const comp = getComponentDetails(reqComp.component_id);
                              const isLoaded = isComponentFullyLoaded(reqComp.component_id);
                              const isSelected = selectedComponentId === reqComp.component_id;
                              
                              return (
                                <button
                                  key={reqComp.component_id}
                                  onClick={() => setSelectedComponentId(reqComp.component_id)}
                                  className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                                    isSelected 
                                      ? 'border-indigo-500 bg-indigo-50' 
                                      : isLoaded
                                      ? 'border-green-300 bg-green-50'
                                      : 'border-slate-200 bg-white hover:border-indigo-300'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <p className="font-medium text-slate-800">{comp?.name}</p>
                                      <p className="text-xs text-slate-500 mt-1">
                                        {getLoadedBinsForComponent(reqComp.component_id).length} bin(s) {t('loaded_by')}
                                      </p>
                                    </div>
                                    {isLoaded && <CheckCircle className="w-5 h-5 text-green-600" />}
                                    {isSelected && !isLoaded && <ChevronRight className="w-5 h-5 text-indigo-600" />}
                                  </div>
                                </button>
                              );
                            })}
                          </CardContent>
                        </Card>
                      </div>

                      {/* Right Column - Loading Form */}
                      <div className="lg:col-span-2">
                        {!selectedComponentId ? (
                          <Card className="border-2 border-dashed border-slate-300">
                            <CardContent className="p-10 text-center">
                              <Package className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                              <p className="text-slate-600">{t('select_component_from_list')}</p>
                            </CardContent>
                          </Card>
                        ) : (
                          <Card className="border-2 border-indigo-200">
                            <CardHeader className="bg-indigo-50">
                              <CardTitle className="text-lg flex items-center gap-2">
                                <Package className="w-5 h-5" />
                                {selectedComponent?.name}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                              {/* Select or Scan PO - Combined Card */}
                              <Card className="border-2 border-slate-200 bg-slate-50">
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-base flex items-center gap-2">
                                    <Package className="w-4 h-4" />
                                    {t('select_purchase_order')}
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                  {/* Scan Bar */}
                                  <div className="bg-white border-2 border-indigo-200 rounded-lg p-4">
                                    <Label className="text-sm font-medium mb-2 block text-indigo-900">
                                      {t('scan_po_number')}
                                    </Label>
                                    <div className="flex items-center gap-2">
                                      <Input
                                        value={poScanInput}
                                        onChange={(e) => setPOScanInput(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handlePOScan(poScanInput);
                                          }
                                        }}
                                        placeholder={t('scan_po_placeholder')}
                                        className="flex-1 h-11 text-base"
                                      />
                                      <Button
                                        onClick={() => handlePOScan(poScanInput)}
                                        variant="default"
                                        size="default"
                                        className="bg-indigo-600 hover:bg-indigo-700 h-11"
                                      >
                                        {t('scan')}
                                      </Button>
                                    </div>
                                  </div>

                                  {/* PO Cards */}
                                  {availablePOs.length === 0 ? (
                                    <Alert>
                                      <AlertTriangle className="h-4 w-4" />
                                      <AlertDescription>
                                        {t('no_pos_with_component')}
                                      </AlertDescription>
                                    </Alert>
                                  ) : (
                                    <div>
                                      <p className="text-sm font-medium text-slate-700 mb-3">
                                        {t('or_select_from_list')}
                                      </p>
                                      <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2">
                                        {availablePOs.map(po => {
                                          const item = po.items.find(i => i.component_id === selectedComponent.id);
                                          const available = item ? item.quantity_ordered - (item.quantity_received || 0) : 0;
                                          const isSelected = selectedPOId === po.id;
                                          
                                          return (
                                            <button
                                              key={po.id}
                                              onClick={() => setSelectedPOId(po.id)}
                                              className={`p-4 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                                                isSelected
                                                  ? 'border-indigo-500 bg-indigo-50 shadow-md'
                                                  : 'border-slate-200 bg-white hover:border-indigo-300'
                                              }`}
                                            >
                                              <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                                                      <Package className={`w-5 h-5 ${isSelected ? 'text-indigo-600' : 'text-slate-600'}`} />
                                                    </div>
                                                    <div>
                                                      <span className="font-bold text-base font-mono block">{po.po_number}</span>
                                                      <span className="text-sm text-slate-600">{po.supplier_name}</span>
                                                    </div>
                                                  </div>
                                                  {isSelected && <CheckCircle className="w-6 h-6 text-indigo-600" />}
                                                </div>
                                                
                                                <div className="flex items-center justify-between pt-2 border-t">
                                                  <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-sm font-semibold">
                                                      {available} {t('available_in_po')}
                                                    </Badge>
                                                    {item.unit_price && (
                                                      <Badge className="bg-green-100 text-green-800 text-sm font-semibold">
                                                        ${item.unit_price.toFixed(2)}/unidad
                                                      </Badge>
                                                    )}
                                                  </div>
                                                  {item.batch_info && (
                                                    <span className="text-xs text-slate-500 italic">
                                                      {item.batch_info}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>

                              {/* Scan Bin Number - MOVED HERE */}
                              <div>
                                <Label className="text-sm font-medium">{t('scan_bin_number')}</Label>
                                <Input
                                  value={binInput}
                                  onChange={(e) => setBinInput(e.target.value)}
                                  placeholder={t('bin_number_placeholder')}
                                  className="mt-1"
                                />
                              </div>

                              {/* Quantity to Load */}
                              <div>
                                <Label className="text-sm font-medium">{t('quantity_to_load')}</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={quantityToLoad}
                                  onChange={(e) => setQuantityToLoad(e.target.value)}
                                  placeholder={t('quantity_to_load_placeholder')}
                                  className="mt-1"
                                />
                              </div>

                              {/* Link Button */}
                              <Button
                                onClick={handleLinkBin}
                                className="w-full bg-indigo-600 hover:bg-indigo-700"
                                disabled={!binInput.trim() || !selectedPOId || !quantityToLoad}
                              >
                                <LinkIcon className="w-4 h-4 mr-2" />
                                {t('link_bin_to_po')}
                              </Button>

                              {/* Loaded Bins for This Component */}
                              {selectedComponentBins.length > 0 && (
                                <div className="mt-6 pt-4 border-t">
                                  <Label className="text-sm font-medium mb-2 block">
                                    {t('bins_loaded')} ({selectedComponentBins.length})
                                  </Label>
                                  <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {selectedComponentBins.map((bin, idx) => (
                                      <div key={idx} className="bg-green-50 border border-green-200 p-3 rounded-lg">
                                        <div className="flex items-center justify-between">
                                          <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-800 font-mono">{bin.bin_number}</p>
                                            <p className="text-xs text-gray-600">PO: {bin.po_number}</p>
                                          </div>
                                          <Badge className="bg-green-600 text-white">
                                            {bin.quantity_loaded} {t('units')}
                                          </Badge>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {selectedVersionId && requiredComponents.length === 0 && (
                  <Alert>
                    <AlertDescription>
                      {t('no_batch_components')}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Create WIP Button */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedVersionId('');
                      setLoadedBins([]);
                      setSelectedComponentId(null);
                      setBinInput('');
                      setSelectedPOId('');
                      setPOScanInput(''); // Clear PO scan input
                      setQuantityToLoad('');
                    }}
                    className="flex-1"
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    onClick={handleCreateWIPLoading}
                    disabled={!allBinsLoaded || isCreating}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('creating_wip')}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {t('create_wip_loading_today')}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
