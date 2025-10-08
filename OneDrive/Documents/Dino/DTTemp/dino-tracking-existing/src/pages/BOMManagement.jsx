import React, { useState, useEffect, useRef, useCallback } from "react";
import { Component, DinosaurVersion, Dinosaur } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Settings, Save, RotateCcw, Package, Target, CheckCircle, AlertTriangle, Edit3, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Default hotspot positions - moved outside component to avoid dependency issues
const defaultHotspots = {
  'carcasa-externa': { top: '25%', left: '25%' },
  'placa-principal': { top: '65%', left: '45%' },
  'bateria': { top: '35%', left: '65%' },
  'altavoz': { top: '45%', left: '45%' },
  'base-soporte': { top: '85%', left: '45%' },
  'tornillos': { top: '90%', left: '25%' },
  'chip-principal': { top: '40%', left: '75%' },
  'sensores': { top: '15%', left: '60%' }
};

export default function BOMManagement() {
  const [components, setComponents] = useState([]);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [projectionQuantity, setProjectionQuantity] = useState(100);
  const [bomData, setBomData] = useState([]);
  const [debugMode, setDebugMode] = useState(false);
  const [hotspots, setHotspots] = useState({});
  const [activeComponent, setActiveComponent] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [editingStock, setEditingStock] = useState(null);
  const [editStockValue, setEditStockValue] = useState("");
  const [dragging, setDragging] = useState(null);

  const imageRef = useRef(null);
  const containerRef = useRef(null);

  const getHotspotId = useCallback((componentName) => {
    // Map component names to hotspot IDs - you can customize this logic
    const name = componentName.toLowerCase();
    if (name.includes('carcasa') || name.includes('housing')) return 'carcasa-externa';
    if (name.includes('placa') || name.includes('pcb') || name.includes('board')) return 'placa-principal';
    if (name.includes('bateria') || name.includes('battery')) return 'bateria';
    if (name.includes('altavoz') || name.includes('speaker')) return 'altavoz';
    if (name.includes('base') || name.includes('soporte')) return 'base-soporte';
    if (name.includes('tornillo') || name.includes('screw')) return 'tornillos';
    if (name.includes('chip') || name.includes('processor')) return 'chip-principal';
    if (name.includes('sensor')) return 'sensores';
    return 'placa-principal'; // Default fallback
  }, []);

  const calculateBOM = useCallback(() => {
    const version = versions.find(v => v.id === selectedVersion);
    if (!version || !version.components) return;

    const bomCalculation = version.components.map(versionComp => {
      const component = components.find(c => c.id === versionComp.component_id);
      if (!component) return null;

      const currentStock = component.quantity || 0;
      const requiredPerUnit = 1;
      const totalRequired = projectionQuantity * requiredPerUnit;
      const shortage = Math.max(0, totalRequired - currentStock);
      
      return {
        id: component.id,
        name: component.name,
        category: component.category || 'otros',
        tracking_type: component.tracking_type,
        current_stock: currentStock,
        required_per_unit: requiredPerUnit,
        total_required: totalRequired,
        shortage: shortage,
        supplier: component.supplier || 'N/A',
        batch_info: versionComp.batch_number || 'N/A',
        hotspot_id: getHotspotId(component.name) // Map component to hotspot
      };
    }).filter(Boolean);

    setBomData(bomCalculation);
  }, [selectedVersion, projectionQuantity, components, versions, getHotspotId]);

  const loadData = useCallback(async () => {
    const [componentsData, versionsData] = await Promise.all([
      Component.list('-created_date'),
      DinosaurVersion.list('-created_date'),
    ]);
    
    setComponents(componentsData);
    setVersions(versionsData);
    
    if (versionsData.length > 0 && !selectedVersion) {
      setSelectedVersion(versionsData[0].id);
    }
  }, [selectedVersion]);

  useEffect(() => {
    loadData();
    // Initialize hotspots from localStorage or use defaults
    const savedHotspots = localStorage.getItem('bomHotspots');
    if (savedHotspots) {
      setHotspots(JSON.parse(savedHotspots));
    } else {
      setHotspots(defaultHotspots);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedVersion && components.length > 0) {
      calculateBOM();
    }
  }, [selectedVersion, projectionQuantity, components, versions, calculateBOM]);

  // Drag functionality for hotspots
  const handleMouseDown = (e, hotspotId) => {
    if (!debugMode) return;
    e.preventDefault();
    setDragging(hotspotId);
    setActiveComponent(hotspotId);
  };

  const handleMouseMove = useCallback((e) => {
    if (!dragging || !debugMode || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Constrain to image bounds
    const constrainedX = Math.max(0, Math.min(100, x));
    const constrainedY = Math.max(0, Math.min(100, y));

    setHotspots(prev => ({
      ...prev,
      [dragging]: {
        top: `${constrainedY}%`,
        left: `${constrainedX}%`
      }
    }));
  }, [dragging, debugMode]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  const saveHotspots = () => {
    localStorage.setItem('bomHotspots', JSON.stringify(hotspots));
    setDebugMode(false);
    setActiveComponent(null);
    alert('Posiciones de hotspots guardadas exitosamente!');
  };

  const resetHotspots = () => {
    setHotspots(defaultHotspots);
    localStorage.removeItem('bomHotspots');
  };

  const handleEditStock = (componentId, currentStock) => {
    setEditingStock(componentId);
    setEditStockValue(currentStock.toString());
  };

  const handleSaveStock = async () => {
    if (editingStock) {
      const newQuantity = parseInt(editStockValue) || 0;
      try {
        await Component.update(editingStock, { quantity: newQuantity });
        // Update local state
        setComponents(prev => prev.map(c => 
          c.id === editingStock ? { ...c, quantity: newQuantity } : c
        ));
        setEditingStock(null);
        setEditStockValue("");
      } catch (error) {
        console.error('Error updating stock:', error);
        alert('Error al actualizar el stock');
      }
    }
  };

  const handleCancelEditStock = () => {
    setEditingStock(null);
    setEditStockValue("");
  };

  const getStatusIcon = (current, required) => {
    if (current >= required) return <CheckCircle className="w-4 h-4 text-green-600" />;
    return <AlertTriangle className="w-4 h-4 text-red-600" />;
  };

  const categoryColors = {
    chips: 'bg-blue-50 text-blue-700 border border-blue-200',
    baterias: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
    sensores: 'bg-purple-50 text-purple-700 border border-purple-200',
    motores: 'bg-green-50 text-green-700 border border-green-200',
    estructuras: 'bg-orange-50 text-orange-700 border border-orange-200',
    otros: 'bg-gray-50 text-gray-700 border border-gray-200'
  };

  const totalShortage = bomData.reduce((sum, item) => sum + item.shortage, 0);
  const totalRequired = bomData.reduce((sum, item) => sum + item.total_required, 0);
  const totalCurrent = bomData.reduce((sum, item) => sum + item.current_stock, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex">
      {/* Main Content - 3/4 of screen */}
      <div className="w-3/4 p-6 overflow-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                BOM Interactive Viewer
              </h1>
              <p className="text-slate-600">Vista interactiva de la Lista de Materiales</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant={debugMode ? "default" : "outline"}
                onClick={() => setDebugMode(!debugMode)}
                className="bg-blue-600 text-white"
              >
                <Settings className="w-4 h-4 mr-2" />
                {debugMode ? 'Salir Debug' : 'Modo Debug'}
              </Button>
              {debugMode && (
                <>
                  <Button onClick={saveHotspots} className="bg-green-600 text-white">
                    <Save className="w-4 h-4 mr-2" />
                    Guardar
                  </Button>
                  <Button onClick={resetHotspots} variant="outline">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-white/90 backdrop-blur-sm shadow-lg mb-6">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Versión del Dinosaurio</label>
                  <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar versión" />
                    </SelectTrigger>
                    <SelectContent>
                      {versions.map(version => (
                        <SelectItem key={version.id} value={version.id}>
                          {version.model_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Objetivo de Producción</label>
                  <Input
                    type="number"
                    value={projectionQuantity}
                    onChange={(e) => setProjectionQuantity(parseInt(e.target.value) || 0)}
                    placeholder="Cantidad a producir..."
                    className="bg-white/50"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {debugMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 p-4 bg-yellow-100/90 border border-yellow-300 rounded-lg backdrop-blur-sm"
          >
            <h3 className="font-semibold text-yellow-800 mb-2">Modo Debug Activado</h3>
            <p className="text-yellow-700 text-sm mb-2">
              🖱️ <strong>Arrastra los puntos</strong> en la imagen para reposicionarlos
            </p>
            <p className="text-yellow-700 text-sm">
              💾 Haz clic en "Guardar" cuando hayas terminado de posicionar todos los puntos
              {activeComponent && <span className="ml-2 font-semibold">| Actualmente moviendo: {activeComponent}</span>}
            </p>
          </motion.div>
        )}

        {/* BOM Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Lista de Materiales ({bomData.length} componentes)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {bomData.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Selecciona una versión para ver los componentes</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b">
                      <tr className="text-left">
                        <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Estado</th>
                        <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Componente</th>
                        <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Categoría</th>
                        <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider text-center">Stock Actual</th>
                        <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider text-center">Necesario</th>
                        <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider text-center">Faltante</th>
                        <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Proveedor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bomData.map((item, index) => (
                        <tr 
                          key={item.id} 
                          className={`hover:bg-blue-50 transition-colors cursor-pointer ${
                            activeComponent === item.hotspot_id ? 'bg-blue-100 border-l-4 border-l-blue-500' : ''
                          }`}
                          onMouseEnter={() => !debugMode && setActiveComponent(item.hotspot_id)}
                          onMouseLeave={() => !debugMode && setActiveComponent(null)}
                          onClick={() => debugMode && setActiveComponent(item.hotspot_id)}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            {getStatusIcon(item.current_stock, item.total_required)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-900">{item.name}</span>
                              <span className="text-xs text-slate-500">{item.tracking_type}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Badge className={`${categoryColors[item.category]} text-xs`}>
                              {item.category}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            {editingStock === item.id ? (
                              <div className="flex items-center justify-center gap-1">
                                <Input
                                  type="number"
                                  value={editStockValue}
                                  onChange={(e) => setEditStockValue(e.target.value)}
                                  className="w-20 h-8 text-center"
                                  autoFocus
                                />
                                <Button size="icon" className="h-6 w-6 bg-green-600" onClick={handleSaveStock}>
                                  <Check className="w-3 h-3" />
                                </Button>
                                <Button size="icon" variant="outline" className="h-6 w-6" onClick={handleCancelEditStock}>
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-2">
                                <span className={`font-semibold ${
                                  item.current_stock >= item.total_required 
                                    ? 'text-green-600' 
                                    : item.current_stock >= item.total_required * 0.5 
                                      ? 'text-yellow-600' 
                                      : 'text-red-600'
                                }`}>
                                  {item.current_stock}
                                </span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-slate-400 hover:text-slate-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditStock(item.id, item.current_stock);
                                  }}
                                >
                                  <Edit3 className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center font-medium text-slate-700">
                            {item.total_required}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            {item.shortage > 0 ? (
                              <span className="font-semibold text-red-600">{item.shortage}</span>
                            ) : (
                              <span className="text-green-600">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">
                            {item.supplier}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Summary Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6"
        >
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Total Requerido</p>
                  <p className="text-2xl font-bold">{totalRequired}</p>
                </div>
                <Target className="w-8 h-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Stock Actual</p>
                  <p className="text-2xl font-bold">{totalCurrent}</p>
                </div>
                <Package className="w-8 h-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-sm">Faltante Total</p>
                  <p className="text-2xl font-bold">{totalShortage}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Listo para Producir</p>
                  <p className="text-2xl font-bold">{Math.floor((totalCurrent / Math.max(totalRequired, 1)) * 100)}%</p>
                </div>
                <CheckCircle className="w-8 h-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Image Panel - 1/4 of screen */}
      <div className="w-1/4 bg-white border-l border-slate-200 p-4 flex flex-col">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Vista Explotada</h3>
        <div className="flex-1 relative" ref={containerRef}>
          <img
            ref={imageRef}
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68af5f6ad9b1f7a20934bb86/787e8bffd_Dino_Cylinder_Assembly2025-07-07exploted.png"
            alt="Vista explotada del dispositivo Dino"
            className="w-full h-full object-contain"
            onLoad={() => setImageLoaded(true)}
            style={{ maxHeight: '80vh' }}
          />
          
          {/* Interactive Hotspots */}
          {imageLoaded && (
            <div className="absolute inset-0">
              {Object.entries(hotspots).map(([hotspotId, coords]) => {
                const isActive = activeComponent === hotspotId;
                const hasComponent = bomData.some(item => item.hotspot_id === hotspotId);
                const component = bomData.find(item => item.hotspot_id === hotspotId);
                
                if (!debugMode && !hasComponent && !isActive) return null;
                
                return (
                  <div
                    key={hotspotId}
                    className={`absolute w-6 h-6 rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${
                      isActive 
                        ? 'bg-orange-500 scale-125 animate-pulse shadow-orange-300 z-20' 
                        : debugMode 
                          ? 'bg-blue-500 hover:scale-110 z-10 cursor-move' 
                          : hasComponent 
                            ? 'bg-green-500 hover:scale-110 z-10 cursor-pointer' 
                            : 'bg-gray-400 z-10'
                    } ${dragging === hotspotId ? 'scale-125 cursor-grabbing' : debugMode ? 'cursor-grab' : ''}`}
                    style={{
                      top: coords.top,
                      left: coords.left
                    }}
                    title={debugMode ? hotspotId : component?.name}
                    onMouseDown={(e) => handleMouseDown(e, hotspotId)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (debugMode) {
                        setActiveComponent(hotspotId);
                      }
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
        
        {debugMode && (
          <div className="mt-4 text-sm text-slate-600 bg-yellow-50 p-3 rounded-lg">
            <p className="font-semibold text-yellow-800 mb-2">🖱️ Modo Debug</p>
            <p>Arrastra los puntos para reposicionarlos. Los puntos azules son arrastrables.</p>
          </div>
        )}
      </div>
    </div>
  );
}