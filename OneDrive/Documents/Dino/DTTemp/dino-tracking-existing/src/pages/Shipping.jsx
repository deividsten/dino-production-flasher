
import React, { useState, useEffect, useRef } from "react";
import { Shipment, Dinosaur } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Plane, ScanLine, Plus, X, CheckCircle, AlertTriangle, Trash2, Eye } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { useWarehouse } from "@/components/WarehouseProvider";

export default function ShippingPage() {
  const { t, language } = useLanguage();
  const { activeWarehouse, filterByWarehouse } = useWarehouse();
  const [shipments, setShipments] = useState([]);
  const [allDinosaurs, setAllDinosaurs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form states
  const [trackingNumber, setTrackingNumber] = useState("");
  const [rfidInput, setRfidInput] = useState("");
  const [scannedRfids, setScannedRfids] = useState([]);
  const [notes, setNotes] = useState("");
  const [scanFeedback, setScanFeedback] = useState({ type: "", message: "" });
  const [isRegistering, setIsRegistering] = useState(false);
  const [expandedShipment, setExpandedShipment] = useState(null);

  const rfidInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [activeWarehouse]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [shipmentsData, dinosaursData] = await Promise.all([
        Shipment.list('-created_date'),
        Dinosaur.list('-created_date')
      ]);
      
      // Filtrar por warehouse
      const filteredShipments = filterByWarehouse(shipmentsData);
      const filteredDinosaurs = filterByWarehouse(dinosaursData);
      
      setShipments(filteredShipments);
      setAllDinosaurs(filteredDinosaurs);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  // The getCurrentOperator function is being inlined as per the outline for handleRegisterShipment
  // const getCurrentOperator = () => {
  //   try {
  //     const operatorData = localStorage.getItem('dinotrack-operator');
  //     if (operatorData) {
  //       return JSON.parse(operatorData);
  //     }
  //   } catch (error) {
  //     console.error("Error reading operator:", error);
  //   }
  //   return null;
  // };

  const handleRfidScan = async () => {
    const rfid = rfidInput.trim();
    
    if (!rfid) return;

    // Check if already scanned
    if (scannedRfids.includes(rfid)) {
      setScanFeedback({ 
        type: "warning", 
        message: t('rfid_already_scanned')
      });
      setTimeout(() => setScanFeedback({ type: "", message: "" }), 2000);
      setRfidInput("");
      return;
    }

    // Verify the dinosaur exists and is available within the active warehouse
    try {
      const dino = allDinosaurs.find(d => d.rfid_code === rfid); // Use pre-filtered allDinosaurs

      if (!dino) {
        setScanFeedback({ 
          type: "error", 
          message: t('dinosaur_not_found_rfid', { rfid })
        });
        setTimeout(() => setScanFeedback({ type: "", message: "" }), 3000);
        setRfidInput("");
        return;
      }
      
      if (dino.status !== 'sold') {
        setScanFeedback({ 
          type: "warning", 
          message: t('dinosaur_not_sold_warning', { rfid, status: dino.status })
        });
        setTimeout(() => setScanFeedback({ type: "", message: "" }), 3000);
      } else {
        setScanFeedback({ 
          type: "success", 
          message: t('rfid_scanned_successfully', { rfid })
        });
        setTimeout(() => setScanFeedback({ type: "", message: "" }), 2000);
      }

      setScannedRfids([...scannedRfids, rfid]);
      setRfidInput("");
      rfidInputRef.current?.focus();
    } catch (error) {
      console.error("Error verifying dinosaur:", error);
      setScanFeedback({ 
        type: "error", 
        message: t('error_verifying_dinosaur')
      });
      setTimeout(() => setScanFeedback({ type: "", message: "" }), 3000);
      setRfidInput("");
    }
  };

  const handleRemoveRfid = (rfidToRemove) => {
    setScannedRfids(scannedRfids.filter(r => r !== rfidToRemove));
  };

  const handleRegisterShipment = async (e) => {
    e.preventDefault();

    if (!activeWarehouse) {
      alert('Por favor selecciona un warehouse');
      return;
    }

    if (!trackingNumber.trim()) {
      alert(t('tracking_number_required'));
      return;
    }

    if (scannedRfids.length === 0) {
      alert(t('at_least_one_rfid_required'));
      return;
    }

    setIsRegistering(true);
    
    try {
      const operator = JSON.parse(localStorage.getItem('dinotrack-operator') || '{}');
      
      const shipmentData = {
        warehouse_id: activeWarehouse.id,
        tracking_number: trackingNumber.trim(),
        dinosaur_rfids: scannedRfids,
        shipping_date: new Date().toISOString(),
        shipped_by_operator: operator.name || 'Unknown',
        notes: notes.trim(),
        destination_country: 'USA'
      };

      await Shipment.create(shipmentData);

      alert(t('shipment_registered_successfully'));
      
      // Clear form
      setTrackingNumber("");
      setRfidInput("");
      setScannedRfids([]);
      setNotes("");
      setScanFeedback({ type: "", message: "" }); // Clear any previous scan feedback

      // Reload data
      loadData();
    } catch (error) {
      console.error(t('error_registering_shipment'), error);
      alert(t('error_registering_shipment') + ': ' + error.message);
    }
    
    setIsRegistering(false);
  };

  const handleDeleteShipment = async (shipment) => {
    if (window.confirm(t('confirm_delete_shipment', { tracking: shipment.tracking_number }))) {
      try {
        await Shipment.delete(shipment.id);
        loadData(); // Reload data
      } catch (error) {
        console.error("Error deleting shipment:", error);
        alert(t('error_deleting_shipment'));
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            {t('shipping_station')}
          </h1>
          <p className="text-slate-600">{t('register_shipments_tracking')}</p>
        </motion.div>

        {/* Registration Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0 mb-8">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-t-lg">
              <CardTitle className="flex items-center gap-2">
                <Package className="w-6 h-6" />
                {t('new_shipment')}
              </CardTitle>
              <CardDescription className="text-white/90">
                {t('scan_dinosaurs_add_tracking')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Tracking Number */}
              <div className="space-y-2">
                <Label htmlFor="tracking">{t('tracking_number')}*</Label>
                <Input
                  id="tracking"
                  placeholder="e.g.: 1Z999AA10123456784"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="bg-white/70 font-mono"
                />
              </div>

              {/* RFID Scanner */}
              <div className="space-y-2">
                <Label htmlFor="rfid">{t('scan_dinosaur_rfids')}</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <ScanLine className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <Input
                      id="rfid"
                      ref={rfidInputRef}
                      placeholder={t('scan_or_enter_rfid')}
                      value={rfidInput}
                      onChange={(e) => setRfidInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleRfidScan();
                        }
                      }}
                      className="pl-10 bg-white/70 font-mono"
                    />
                  </div>
                  <Button 
                    onClick={handleRfidScan}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>

                {/* Scan Feedback */}
                <AnimatePresence>
                  {scanFeedback.message && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <Alert className={
                        scanFeedback.type === "success" ? "bg-green-50 border-green-200" :
                        scanFeedback.type === "warning" ? "bg-yellow-50 border-yellow-200" :
                        "bg-red-50 border-red-200"
                      }>
                        <AlertDescription className={
                          scanFeedback.type === "success" ? "text-green-800" :
                          scanFeedback.type === "warning" ? "text-yellow-800" :
                          "text-red-800"
                        }>
                          {scanFeedback.message}
                        </AlertDescription>
                      </Alert>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Scanned RFIDs List */}
              {scannedRfids.length > 0 && (
                <div className="space-y-2">
                  <Label>{t('scanned_dinosaurs')} ({scannedRfids.length})</Label>
                  <div className="bg-slate-50 rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
                    {scannedRfids.map((rfid, index) => (
                      <motion.div
                        key={rfid}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center justify-between bg-white p-3 rounded border"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="font-mono text-sm">{rfid}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveRfid(rfid)}
                          className="h-8 w-8 text-red-500 hover:bg-red-100"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">{t('additional_notes_optional')}</Label>
                <Textarea
                  id="notes"
                  placeholder={t('shipment_notes_placeholder')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-white/70 h-24"
                />
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={handleRegisterShipment}
                  disabled={isRegistering || scannedRfids.length === 0 || !trackingNumber.trim()}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  {isRegistering ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Plane className="w-5 h-5 mr-2" />
                      </motion.div>
                      {t('registering')}...
                    </>
                  ) : (
                    <>
                      <Plane className="w-5 h-5 mr-2" />
                      {t('register_shipment')}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Shipments History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-2xl font-bold text-slate-700 mb-4">{t('recent_shipments')}</h2>
          
          {isLoading ? (
            <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
              <CardContent className="p-12 text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="inline-block"
                >
                  <Package className="w-12 h-12 text-blue-400" />
                </motion.div>
                <p className="text-slate-600 mt-4">{t('loading')}...</p>
              </CardContent>
            </Card>
          ) : shipments.length === 0 ? (
            <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
              <CardContent className="p-12 text-center">
                <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-600 mb-2">
                  {t('no_shipments_registered')}
                </h3>
                <p className="text-slate-500">
                  {t('start_by_registering_first_shipment')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {shipments.map((shipment, index) => (
                <motion.div
                  key={shipment.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 border-0 overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-600" />
                    
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Package className="w-5 h-5 text-blue-600" />
                            <h3 className="font-bold text-lg text-slate-800">{t('tracking')}: {shipment.tracking_number}</h3>
                            <Badge className="bg-blue-100 text-blue-800">
                              {shipment.dinosaur_rfids?.length || 0} {t('dinosaurs')}
                            </Badge>
                          </div>
                          
                          <div className="text-sm text-slate-600 space-y-1">
                            <p>{t('shipped_by')}: {shipment.shipped_by_operator}</p>
                            <p>{t('date')}: {new Date(shipment.shipping_date || shipment.created_date).toLocaleString(language === 'es' ? 'es-ES' : language === 'zh' ? 'zh-CN' : 'en-US', { timeZone: 'America/Los_Angeles' })}</p>
                            {shipment.notes && <p className="italic">{shipment.notes}</p>}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setExpandedShipment(expandedShipment === shipment.id ? null : shipment.id)}
                            className="bg-white/80"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            {expandedShipment === shipment.id ? t('hide_details') : t('view_details')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteShipment(shipment)}
                            className="bg-white/80 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      <AnimatePresence>
                        {expandedShipment === shipment.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 pt-4 border-t"
                          >
                            <Label className="text-sm font-semibold text-slate-700 mb-2 block">
                              {t('dinosaurs_in_shipment')}:
                            </Label>
                            <div className="bg-slate-50 rounded p-3 max-h-40 overflow-y-auto">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {shipment.dinosaur_rfids?.map((rfid, idx) => (
                                  <div key={idx} className="bg-white px-3 py-2 rounded border text-sm font-mono">
                                    {rfid}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
