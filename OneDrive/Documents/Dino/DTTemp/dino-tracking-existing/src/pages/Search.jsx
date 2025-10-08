import React, { useState } from "react";
import { Sale, Dinosaur, DinosaurVersion, Device } from "@/api/entities"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Search as SearchIcon, Loader2, Frown, Eye, Edit, Cpu, Package } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import DinosaursList from "../components/dinosaurs/DinosaursList";
import SalesList from "../components/sales/SalesList";
import DevicesList from "../components/devices/DevicesList";
import DeviceDetails from "../components/devices/DeviceDetails";

export default function Search() {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [selectedDeviceForDetails, setSelectedDeviceForDetails] = useState(null);
  const [componentMatches, setComponentMatches] = useState([]); // Track which components matched

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setIsLoading(true);
    setSearchAttempted(true);
    setResults(null);
    setComponentMatches([]);

    try {
      const searchLower = searchTerm.toLowerCase();
      
      // Path 1: Search sales by Shopify order number or Dinosaur RFID
      const salesByOrder = await Sale.filter({ shopify_order_number: searchTerm });
      const salesByRfid = await Sale.filter({ dinosaur_rfid: searchTerm });
      const salesDinoRfids = [...salesByOrder, ...salesByRfid].map(s => s.dinosaur_rfid);

      // Path 2: Search dinosaurs directly by RFID
      const dinosByRfid = await Dinosaur.filter({ rfid_code: searchTerm });
      const directDinoRfids = dinosByRfid.map(d => d.rfid_code);

      // Path 3: Search devices by device_id
      const devicesByDeviceId = await Device.filter({ device_id: searchTerm });
      const deviceIds = devicesByDeviceId.map(d => d.device_id);

      // Path 4: Search ALL devices and dinosaurs, then filter by component serial
      const allDevices = await Device.list();
      const allDinosaurs = await Dinosaur.list();
      
      const componentMatchInfo = [];
      
      // Search in devices for component serials
      const devicesByComponentSerial = allDevices.filter(device => {
        if (!device.components_used || !Array.isArray(device.components_used)) return false;
        
        const matchedComponent = device.components_used.find(comp => 
          comp.serial_number && comp.serial_number.toLowerCase().includes(searchLower)
        );
        
        if (matchedComponent) {
          componentMatchInfo.push({
            type: 'device',
            itemId: device.device_id,
            componentName: matchedComponent.component_name,
            serialNumber: matchedComponent.serial_number,
            trackingType: matchedComponent.tracking_type
          });
          return true;
        }
        return false;
      });
      
      const moreDeviceIds = devicesByComponentSerial.map(d => d.device_id);
      
      // Combine all unique device IDs
      const allUniqueDeviceIds = [...new Set([...deviceIds, ...moreDeviceIds])];
      
      // Get dinosaurs that use these devices
      let dinosByDeviceIds = [];
      if (allUniqueDeviceIds.length > 0) {
        dinosByDeviceIds = await Dinosaur.filter({ device_id: { $in: allUniqueDeviceIds } });
      }
      const deviceDinoRfids = dinosByDeviceIds.map(d => d.rfid_code);
      
      // Path 5: Search dinosaurs by component serial numbers in dinosaur records
      const dinosBySerialInRecord = allDinosaurs.filter(dino => {
        if (!dino.component_serials || !Array.isArray(dino.component_serials)) return false;
        
        const matchedComponent = dino.component_serials.find(compSerial => 
          compSerial.serial_number && compSerial.serial_number.toLowerCase().includes(searchLower)
        );
        
        if (matchedComponent) {
          componentMatchInfo.push({
            type: 'dinosaur',
            itemId: dino.rfid_code,
            componentName: matchedComponent.component_name,
            serialNumber: matchedComponent.serial_number,
            trackingType: 'unidad'
          });
          return true;
        }
        return false;
      });
      const serialInRecordRfids = dinosBySerialInRecord.map(d => d.rfid_code);

      // Combine all unique RFIDs from all search paths
      const uniqueDinoRfids = [
        ...new Set([
          ...salesDinoRfids,
          ...directDinoRfids,
          ...deviceDinoRfids,
          ...serialInRecordRfids
        ])
      ];

      // Fetch final records
      const [finalDinos, finalSales, finalDevices, versions] = await Promise.all([
        uniqueDinoRfids.length > 0 ? Dinosaur.filter({ rfid_code: { $in: uniqueDinoRfids } }) : [],
        uniqueDinoRfids.length > 0 ? Sale.filter({ dinosaur_rfid: { $in: uniqueDinoRfids } }) : [],
        allUniqueDeviceIds.length > 0 ? Device.filter({ device_id: { $in: allUniqueDeviceIds } }) : [],
        DinosaurVersion.list()
      ]);
      
      if (finalDinos.length > 0 || finalSales.length > 0 || finalDevices.length > 0) {
        setResults({ 
          dinosaurs: finalDinos, 
          sales: finalSales, 
          devices: finalDevices,
          versions 
        });
        setComponentMatches(componentMatchInfo);
      } else {
        setResults(null);
        setComponentMatches([]);
      }
    } catch (error) {
      console.error("Search error:", error);
      setResults(null);
      setComponentMatches([]);
    }
    
    setIsLoading(false);
  };
  
  const handleEditDinosaur = (dino) => {
    window.location.href = createPageUrl(`Dinosaurs?edit_id=${dino.id}`);
  };

  const handleViewDinosaur = (dino) => {
    window.location.href = createPageUrl('Dinosaurs');
  };

  const handleEditDevice = (device) => {
    sessionStorage.setItem('editDevice', JSON.stringify(device));
    window.location.href = createPageUrl('Devices') + '?editDevice=true';
  };

  const handleViewDeviceDetails = (device) => {
    setSelectedDeviceForDetails(device);
  };

  const handleDeleteDevice = async (deviceToDelete) => {
    if (deviceToDelete.status === 'used') {
      alert("No se puede eliminar un dispositivo que ya está asignado a un dinosaurio. Primero elimina el dinosaurio asociado.");
      return;
    }

    if (window.confirm(`¿Estás seguro de que quieres eliminar el dispositivo con ID "${deviceToDelete.device_id}"? Esta acción no se puede deshacer.`)) {
      try {
        await Device.delete(deviceToDelete.id);
        setResults(prevResults => ({
          ...prevResults,
          devices: prevResults.devices.filter(d => d.id !== deviceToDelete.id)
        }));
        alert("Dispositivo eliminado exitosamente.");
      } catch (error) {
        console.error("Error deleting device:", error);
        alert("Ocurrió un error al eliminar el dispositivo.");
      }
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-2">
              Inventory Search
            </h1>
            <p className="text-slate-600">Find items by Order #, RFID, Device ID, or Component Serial Number.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
              <CardContent className="p-6">
                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
                  <Input
                    placeholder="Enter Shopify Order #, Dino RFID, Device ID, or Component Serial..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-4 bg-white/50 text-lg flex-1 h-12 font-mono"
                  />
                  <Button
                    type="submit"
                    className="h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <SearchIcon className="w-5 h-5 mr-2" />
                    )}
                    Search
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
          
          <div className="mt-8">
            {isLoading && (
              <div className="flex justify-center items-center p-12 text-purple-600">
                <Loader2 className="w-12 h-12 animate-spin" />
              </div>
            )}
            
            {!isLoading && searchAttempted && !results && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
                  <CardContent className="p-12 text-center">
                    <Frown className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-slate-600 mb-2">
                      No results found
                    </h3>
                    <p className="text-slate-500">
                      We couldn't find any dinosaur, device, or sale matching "{searchTerm}".
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {results && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                {/* Component Match Highlight */}
                {componentMatches.length > 0 && (
                  <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-emerald-800">
                        <Package className="w-6 h-6" />
                        Component Match Found
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {componentMatches.map((match, idx) => (
                          <div key={idx} className="bg-white/70 rounded-lg p-4 border border-emerald-200">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge className="bg-emerald-600">
                                    {match.type === 'device' ? 'Device' : 'Dinosaur'}
                                  </Badge>
                                  <span className="font-mono text-slate-700 font-semibold">
                                    {match.itemId}
                                  </span>
                                </div>
                                <div className="text-sm text-slate-600">
                                  <span className="font-semibold">Component:</span> {match.componentName}
                                </div>
                                <div className="text-sm text-emerald-700 font-mono mt-1">
                                  <span className="font-semibold">Serial:</span> {match.serialNumber}
                                </div>
                              </div>
                              <Badge variant="outline" className="capitalize">
                                {match.trackingType}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {results.devices.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-2xl font-bold text-slate-700">Found Devices ({results.devices.length})</h2>
                      <div className="flex gap-2">
                        <Link to={createPageUrl('Devices')}>
                          <Button variant="outline" className="bg-white/80">
                            <Eye className="w-4 h-4 mr-2" />
                            Go to Device Management
                          </Button>
                        </Link>
                      </div>
                    </div>
                    <SearchDevicesList 
                      devices={results.devices} 
                      versions={results.versions} 
                      onEdit={handleEditDevice} 
                      onDelete={handleDeleteDevice}
                      onViewDetails={handleViewDeviceDetails}
                      componentMatches={componentMatches}
                    />
                  </div>
                )}

                {results.dinosaurs.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-2xl font-bold text-slate-700">Found Dinosaurs ({results.dinosaurs.length})</h2>
                      <div className="flex gap-2">
                        <Link to={createPageUrl('Dinosaurs')}>
                          <Button variant="outline" className="bg-white/80">
                            <Eye className="w-4 h-4 mr-2" />
                            Go to Dinosaur Management
                          </Button>
                        </Link>
                      </div>
                    </div>
                    <SearchDinosaursList 
                      dinosaurs={results.dinosaurs} 
                      versions={results.versions} 
                      onEdit={handleEditDinosaur}
                      onView={handleViewDinosaur}
                      componentMatches={componentMatches}
                    />
                  </div>
                )}

                {results.sales.length > 0 && (
                   <div>
                      <h2 className="text-2xl font-bold text-slate-700 mb-4">Related Sales ({results.sales.length})</h2>
                      <SalesList sales={results.sales} />
                   </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {selectedDeviceForDetails && (
        <DeviceDetails 
          device={selectedDeviceForDetails}
          versions={results?.versions || []}
          onClose={() => setSelectedDeviceForDetails(null)}
        />
      )}
    </>
  );
}

function SearchDevicesList({ devices, versions, onEdit, onDelete, onViewDetails, componentMatches = [] }) {
  if (!devices || devices.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
        <CardContent className="p-12 text-center">
          <p className="text-slate-500">No devices found</p>
        </CardContent>
      </Card>
    );
  }

  const versionLookup = (versions || []).reduce((acc, version) => {
    if (version && version.id) {
      acc[version.id] = version;
    }
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {devices.map((device, index) => {
        const version = versionLookup[device.version_id];
        const matchedComponents = componentMatches.filter(m => m.type === 'device' && m.itemId === device.device_id);
        const hasMatch = matchedComponents.length > 0;
        
        return (
          <motion.div
            key={device.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className={`bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 border-0 overflow-hidden ${
              hasMatch ? 'ring-2 ring-emerald-400' : ''
            }`}>
              <div className={`h-1 ${hasMatch ? 'bg-gradient-to-r from-emerald-400 to-teal-600' : 'bg-gradient-to-r from-purple-400 to-indigo-600'}`} />
              
              <CardContent className="p-6">
                {hasMatch && (
                  <div className="mb-3 p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                      <Package className="w-4 h-4" />
                      Component Match
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800 text-lg mb-1">
                      {version?.model_name || "Unknown Version"}
                    </h3>
                    <p className="text-sm text-slate-500 font-mono">
                      Device: {device.device_id}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      Status: <span className="capitalize font-medium">{device.status}</span>
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onViewDetails(device)}
                    className="flex-1"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onEdit(device)}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

function SearchDinosaursList({ dinosaurs, versions, onEdit, onView, componentMatches = [] }) {
  if (!dinosaurs || dinosaurs.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
        <CardContent className="p-12 text-center">
          <p className="text-slate-500">No dinosaurs found</p>
        </CardContent>
      </Card>
    );
  }

  const versionLookup = (versions || []).reduce((acc, version) => {
    if (version && version.id) {
      acc[version.id] = version;
    }
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {dinosaurs.map((dinosaur, index) => {
        const version = versionLookup[dinosaur.version_id];
        const matchedComponents = componentMatches.filter(m => m.type === 'dinosaur' && m.itemId === dinosaur.rfid_code);
        const hasMatch = matchedComponents.length > 0;
        
        return (
          <motion.div
            key={dinosaur.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className={`bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 border-0 overflow-hidden ${
              hasMatch ? 'ring-2 ring-emerald-400' : ''
            }`}>
              <div className={`h-1 ${hasMatch ? 'bg-gradient-to-r from-emerald-400 to-teal-600' : 'bg-gradient-to-r from-emerald-400 to-emerald-600'}`} />
              
              <CardContent className="p-6">
                {hasMatch && (
                  <div className="mb-3 p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                      <Package className="w-4 h-4" />
                      Component Match
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800 text-lg mb-1">
                      {version?.model_name || "Unknown Version"}
                    </h3>
                    <p className="text-sm text-slate-500 font-mono">
                      RFID: {dinosaur.rfid_code}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      Color: <span className="capitalize font-medium">{dinosaur.color}</span>
                    </p>
                    <p className="text-sm text-slate-500">
                      Status: <span className="capitalize font-medium">{dinosaur.status}</span>
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onView(dinosaur)}
                    className="flex-1"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onEdit(dinosaur)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}