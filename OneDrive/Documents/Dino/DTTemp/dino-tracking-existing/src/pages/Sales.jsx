
import React, { useState, useEffect, useCallback } from "react";
import { Sale, Dinosaur } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ShoppingCart, CheckCircle, AlertTriangle, ScanLine, History, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";
import { useWarehouse } from "@/components/WarehouseProvider";
import SalesList from "../components/sales/SalesList";
import { formatDistanceToNow } from 'date-fns';
import { es, zhCN } from 'date-fns/locale';

// Helper function to increment order numbers like #1001, SP-1002, etc.
const incrementOrderNumber = (lastOrderNumber) => {
  if (!lastOrderNumber) return "#1001";
  
  const matches = lastOrderNumber.match(/\d+/g);
  if (!matches) return `${lastOrderNumber}-1`;
  
  const lastNumberStr = matches[matches.length - 1];
  const nextNumber = parseInt(lastNumberStr, 10) + 1;
  const lastIndex = lastOrderNumber.lastIndexOf(lastNumberStr);
  
  return lastOrderNumber.substring(0, lastIndex) + nextNumber.toString().padStart(lastNumberStr.length, '0');
};

export default function SalesPage() { // Renamed from Sales to SalesPage
  const { t, language } = useLanguage();
  const { activeWarehouse, filterByWarehouse } = useWarehouse(); // Added useWarehouse hook
  const [nextOrderNumber, setNextOrderNumber] = useState("");
  const [rfid, setRfid] = useState(""); // The confirmed RFID for sale
  const [notes, setNotes] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState(null); // Consolidated error state
  const [lastSale, setLastSale] = useState(null);
  const [recentSales, setRecentSales] = useState([]); // State for recent sales list

  const [rfidInput, setRfidInput] = useState(""); // Raw input as it's being typed
  const [lastProcessedRfid, setLastProcessedRfid] = useState(""); // Last complete RFID that was processed
  const [recentRfidCodes, setRecentRfidCodes] = useState([]); // Track recent complete codes for interference detection
  
  const [editingSale, setEditingSale] = useState(null); // State to track if a sale is being edited
  const [forceRegistrationData, setForceRegistrationData] = useState(null); // New state for force registration

  const RFID_CODE_LENGTH = 24; // Expected length of RFID codes

  // loadRecentSales now filters by activeWarehouse
  const loadRecentSales = useCallback(async () => {
    // Fetch all recent sales, then filter by activeWarehouse
    const allRecentSalesData = await Sale.list('-created_date', 5);
    const filteredRecentSales = filterByWarehouse(allRecentSalesData);
    setRecentSales(filteredRecentSales);
  }, [filterByWarehouse]); // Dependency for filterByWarehouse

  useEffect(() => {
    const fetchInitialData = async () => {
      // Fetch last sales, then filter by activeWarehouse
      const allLastSales = await Sale.list('-created_date', 1);
      const filteredLastSales = filterByWarehouse(allLastSales);

      if (filteredLastSales.length > 0) {
        if (!editingSale) { // Only update if not in edit mode
            setNextOrderNumber(incrementOrderNumber(filteredLastSales[0].shopify_order_number));
        }
      } else {
        setNextOrderNumber("#1001");
      }
      loadRecentSales();
    };
    fetchInitialData();
  }, [editingSale, loadRecentSales, filterByWarehouse]); // Added filterByWarehouse to dependencies

  // New function to validate RFID and set error/forceRegistrationData
  const validateRfid = useCallback(async (rfidCode) => {
    setError(null); // Clear previous RFID validation errors
    setForceRegistrationData(null); // Clear previous force registration data

    if (!rfidCode) return; // Should not happen if called correctly

    try {
      // Filter dinosaurs and sales by RFID and active warehouse
      const dinosaurRecords = await Dinosaur.filter({ rfid_code: rfidCode, warehouse_id: activeWarehouse?.id });
      const salesRecords = await Sale.filter({ dinosaur_rfid: rfidCode, warehouse_id: activeWarehouse?.id });
      
      const locale = language === 'es' ? es : (language === 'zh' ? zhCN : undefined);

      if (dinosaurRecords.length === 0) {
        // Dinosaur not found in inventory for the active warehouse
        if (salesRecords.length > 0) {
          const mostRecentSale = salesRecords.sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())[0];
          const saleDate = new Date(mostRecentSale.created_date);
          const formattedSaleDate = saleDate.toLocaleString(
            language === 'es' ? 'es-ES' : (language === 'zh' ? 'zh-CN' : 'en-US'),
            { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }
          );
          const timeAgo = formatDistanceToNow(saleDate, { addSuffix: true, locale: locale });
          
          setError({
            type: 'not_found_with_history',
            message: t('dino_not_found_with_history', {
              rfid: rfidCode,
              orderNumber: mostRecentSale.shopify_order_number || t('unknown'), // Defensive check
              formattedSaleDate: formattedSaleDate,
              timeAgo: timeAgo,
              count: salesRecords.length
            })
          });
          setForceRegistrationData({ rfid: rfidCode, orderNumber: nextOrderNumber, notes: notes });
        } else {
          setError({
            type: 'not_found_no_history',
            message: t('dino_not_found_no_history', { rfid: rfidCode })
          });
          setForceRegistrationData({ rfid: rfidCode, orderNumber: nextOrderNumber, notes: notes });
        }
        return;
      }

      // Dinosaur found in inventory for the active warehouse
      const availableDinosaurs = dinosaurRecords.filter(d => d.status === 'available');
      
      if (availableDinosaurs.length === 0) {
        const dinosaur = dinosaurRecords[0]; // Take the first one for status check
        if (dinosaur.status === 'sold' && salesRecords.length > 0) {
          const mostRecentSale = salesRecords.sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())[0];
          const saleDate = new Date(mostRecentSale.created_date);
          const formattedSaleDate = saleDate.toLocaleString(
            language === 'es' ? 'es-ES' : (language === 'zh' ? 'zh-CN' : 'en-US'),
            { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }
          );
          const timeAgo = formatDistanceToNow(saleDate, { addSuffix: true, locale: locale });

          setError({
            type: 'already_sold',
            message: t('dino_already_sold', {
              orderNumber: mostRecentSale.shopify_order_number || t('unknown'), // Defensive check
              formattedSaleDate: formattedSaleDate,
              timeAgo: timeAgo,
              count: salesRecords.length
            })
          });
          setForceRegistrationData({ rfid: rfidCode, orderNumber: nextOrderNumber, notes: notes }); // Allow force if already sold
        } else {
          setError({
            type: 'not_available',
            message: t('dino_not_available', { rfid: rfidCode, status: dinosaur.status || t('unknown') }) // Defensive check
          });
          // Do NOT set forceRegistrationData for 'not_available' with non-sold status, as it's not a recoverable scenario by force
        }
        return;
      }

      if (availableDinosaurs.length > 1) {
        console.warn(t('multiple_available_dinos_warning', { rfid: rfidCode }));
      }
      
      // If no issues, ensure error and forceRegistrationData are cleared
      setError(null);
      setForceRegistrationData(null);

    } catch (err) {
      console.error("Error validating RFID:", err);
      setError({ type: 'validation_error', message: t('rfid_validation_failed', { error: err.message }) });
      setForceRegistrationData(null);
    }
  }, [t, language, nextOrderNumber, notes, activeWarehouse?.id]); // Added activeWarehouse.id to dependencies

  const handleRfidChange = (e) => {
    const value = e.target.value.trim();
    setRfidInput(value);

    // Clear any previous general error or force registration data when user starts typing
    if (error && error.type !== 'submit') { // Only clear non-submit errors
      setError(null);
    }
    setForceRegistrationData(null); // Always clear force registration data on new input

    // If the code reaches expected length, process it
    if (value.length === RFID_CODE_LENGTH) {
      // Check if it's the same as the last processed code (ignore repetitions)
      if (value === lastProcessedRfid) {
        // Same code scanned again, ignore it and clear the input
        setRfidInput("");
        return;
      }

      // Add to recent codes for interference detection
      const newRecentCodes = [...recentRfidCodes, value].slice(-3); // Keep last 3 complete codes
      setRecentRfidCodes(newRecentCodes);

      // Check for interference (multiple different complete codes)
      const uniqueCodes = [...new Set(newRecentCodes)];
      if (uniqueCodes.length > 1) {
        setError({ type: 'interference', message: t('interference_detected') });
        // Do not set the rfid state, just clear input and recent codes after a short delay
        setTimeout(() => {
          setError(null);
          setRecentRfidCodes([]);
          setRfidInput("");
          setRfid(""); // Clear the confirmed RFID as well if interference occurs
          setLastProcessedRfid(""); // Reset last processed to avoid ignoring a valid rescan after interference clears
          setForceRegistrationData(null); // Clear force registration data on interference
        }, 2000);
        return;
      }

      // New unique code - process it
      setRfid(value);
      setLastProcessedRfid(value);
      setRecentRfidCodes([]);
      setRfidInput(""); // Clear input for next scan
      setError(null); // Clear any previous error as a new valid RFID is processed (will be re-validated)
      setForceRegistrationData(null); // Clear force registration data as a new valid RFID is processed

      // Validate the confirmed RFID
      validateRfid(value);

    } else if (value.length > RFID_CODE_LENGTH) {
        // If the input is longer than expected, it might be an invalid scan or interference
        setError({ type: 'scan_error', message: t('rfid_too_long', { length: value.length, expected: RFID_CODE_LENGTH }) });
        setRfid("");
        setRfidInput("");
        setRecentRfidCodes([]);
        setLastProcessedRfid("");
        setForceRegistrationData(null); // Clear force registration data on scan error
        setTimeout(() => setError(null), 2000);
    } else if (value.length === 0) {
        // If the input is cleared by scanner or user, clear relevant states
        setRfid("");
        setError(null);
        setRecentRfidCodes([]);
        setLastProcessedRfid("");
        setForceRegistrationData(null); // Clear force registration data on clear
    }
  };
  
  const resetForm = useCallback(() => {
    setRfid("");
    setRfidInput("");
    setNotes("");
    setError(null); // Clear all errors
    setIsRegistering(false);
    setLastProcessedRfid(""); // Reset last processed RFID
    setRecentRfidCodes([]); // Clear recent codes
    setEditingSale(null); // Also reset editing state
    setForceRegistrationData(null); // Clear force registration data
    // Focus back on RFID input for next scan
    setTimeout(() => document.getElementById("rfid_code")?.focus(), 100);
  }, []);

  const handleEdit = (sale) => {
    setEditingSale(sale);
    setNextOrderNumber(sale.shopify_order_number);
    setRfid(sale.dinosaur_rfid);
    setNotes(sale.notes || "");
    setError(null); // Clear any errors from previous operations
    setForceRegistrationData(null); // Clear force registration data when editing
    // When editing, immediately validate the RFID of the sale being edited to show its status
    validateRfid(sale.dinosaur_rfid);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleCancelEdit = () => {
      resetForm();
  };

  const handleDeleteSale = async (sale) => {
    if (window.confirm(t('confirm_delete_sale', { orderNumber: sale.shopify_order_number || '' }))) { // Use t() for confirmation message
      try {
        // First, find and update the dinosaur status back to available in the current warehouse
        const dinosaurs = await Dinosaur.filter({ rfid_code: sale.dinosaur_rfid, warehouse_id: activeWarehouse?.id }); // Added warehouse_id
        if (dinosaurs.length > 0) {
          const dinosaur = dinosaurs[0];
          await Dinosaur.update(dinosaur.id, { status: 'available' });
        }

        // Delete the sale
        await Sale.delete(sale.id);
        
        // Refresh the recent sales list
        loadRecentSales();
        
        // Show success message
        setLastSale({ 
          ...sale, 
          shopify_order_number: `${sale.shopify_order_number || t('unknown_order_number')} (${t('deleted')})`, // Defensive check & t()
          dinosaur_rfid: sale.dinosaur_rfid 
        });

      } catch (error) {
        console.error("Error deleting sale:", error);
        setError({ type: 'submit', message: t('error_deleting_sale', { error: error.message }) }); // Use consolidated error state
      }
    }
  };

  const handleForceRegister = async () => {
    if (!forceRegistrationData) return;
    
    setIsRegistering(true);
    setError(null); // Clear any previous errors

    try {
      const saleData = {
        dinosaur_rfid: forceRegistrationData.rfid,
        shopify_order_number: forceRegistrationData.orderNumber,
        notes: (forceRegistrationData.notes ? `${forceRegistrationData.notes}\n\n` : '') + t('warning_force_registered_dino', { rfid: forceRegistrationData.rfid }).trim(),
        tracking_status: "incomplete", // Mark as incomplete since dino not found in inventory or was sold
        warehouse_id: activeWarehouse?.id, // Added warehouse_id
      };

      const createdSale = await Sale.create(saleData);
      
      setLastSale(createdSale);
      setRecentSales(prev => [createdSale, ...prev.slice(0, 4)]);
      setNextOrderNumber(incrementOrderNumber(createdSale.shopify_order_number));
      
      resetForm(); // Resets forceRegistrationData as well

    } catch (err) {
      setError({ type: 'submit', message: err.message });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleCancelForce = () => {
    setForceRegistrationData(null);
    setError(null); // Clear the error that led to force registration
    setIsRegistering(false); // Ensure registering state is reset
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!activeWarehouse?.id) {
      setError({ type: 'submit', message: t('no_warehouse_selected_error') });
      return;
    }

    if (isRegistering) return; // Prevent double submission

    // If editing, just update the sale
    if (editingSale) {
        setIsRegistering(true);
        setError(null);
        try {
            const updatedSale = await Sale.update(editingSale.id, {
                shopify_order_number: nextOrderNumber,
                notes: notes,
                // Assuming warehouse_id isn't user-editable in the form,
                // but should be part of the sale record. We take it from the existing sale.
                warehouse_id: editingSale.warehouse_id || activeWarehouse?.id,
            });
            setLastSale(updatedSale); // Show success message for the update
            loadRecentSales(); // Refresh the list
            resetForm();
        } catch (err) {
            setError({ type: 'submit', message: err.message });
        } finally {
            setIsRegistering(false);
        }
        return;
    }

    // New sale registration logic
    if (!rfid) {
        setError({ type: 'submit', message: t('scan_rfid_required') });
        return;
    }
    
    if (!nextOrderNumber) {
        setError({ type: 'submit', message: t('order_number_required') });
        return;
    }

    // If there's an active RFID validation error that requires force registration,
    // the main submit button should ideally be disabled or handled by the force button.
    // If we reach here and forceRegistrationData is present, it means the user clicked
    // the main submit button even with an unresolved RFID issue.
    // We prevent this here.
    if (forceRegistrationData) {
        setError({ type: 'submit', message: t('resolve_rfid_issue_or_force_register') });
        return;
    }

    // If there's an RFID error that does NOT allow force registration (e.g., 'not_available' for non-sold status, or interference, scan_error),
    // then block submission.
    if (error && (error.type === 'interference' || error.type === 'scan_error' || error.type === 'not_available' || error.type === 'validation_error')) {
        setError({ type: 'submit', message: t('please_resolve_rfid_error') });
        return;
    }
    
    // At this point, rfid is set, order number is set, and there are no blocking RFID validation errors.
    // Proceed with normal sale creation.
    setIsRegistering(true);
    setError(null); // Clear any previous errors

    try {
      // Find dinosaurs in the active warehouse
      const dinosaurs = await Dinosaur.filter({ rfid_code: rfid, warehouse_id: activeWarehouse?.id });
      
      // If validateRfid was called and returned no error, it means dinosaur is available.
      // However, we still need to fetch it to get its ID and update its status.
      // This is a redundant check if validateRfid is perfectly up-to-date, but a safeguard against race conditions.
      const availableDinosaurs = dinosaurs.filter(d => d.status === 'available');

      if (availableDinosaurs.length === 0) {
        // This case should ideally be caught by validateRfid and set an error/forceRegistrationData.
        // If we reach here, it implies a race condition or logic error.
        console.error("Logic error: handleSubmit reached with non-available dinosaur after validation.");
        throw new Error(t('dino_status_changed_unexpectedly'));
      }
      
      const dinosaur = availableDinosaurs[0]; // Use the first available dinosaur

      const saleData = {
        dinosaur_rfid: rfid,
        shopify_order_number: nextOrderNumber,
        notes: notes,
        tracking_status: "complete", // Mark as complete since dino was found and available
        warehouse_id: activeWarehouse?.id, // Added warehouse_id
      };

      const createdSale = await Sale.create(saleData);
      await Dinosaur.update(dinosaur.id, { status: 'sold' });

      setLastSale(createdSale); // This triggers the success message animation
      // Add the new sale to the top of the recent sales list
      setRecentSales(prev => [createdSale, ...prev.slice(0, 4)]); // Keep the last 5 sales
      // Update the next order number based on the sale we just created
      setNextOrderNumber(incrementOrderNumber(createdSale.shopify_order_number));
      
      resetForm(); // Clears rfid, notes, error, forceRegistrationData etc.

    } catch (err) {
      setError({ type: 'submit', message: err.message });
    } finally {
      setIsRegistering(false);
    }
  };
  
  useEffect(() => {
    if (!editingSale) {
        document.getElementById("rfid_code")?.focus();
    }
  }, [editingSale]);

  // Determine if the main submit button should be disabled
  const isSubmitDisabled = isRegistering || (!rfid && !editingSale) || !nextOrderNumber || (error && !forceRegistrationData) || !activeWarehouse?.id; // Disable if no active warehouse

  // Determine if the "Continue Anyway" (force register) button should be shown
  const showForceRegisterButtons = forceRegistrationData && (
    error?.type === 'not_found_with_history' || 
    error?.type === 'not_found_no_history' ||
    error?.type === 'already_sold'
  );


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50 p-6">
      <div className="w-full max-w-2xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="bg-white/90 backdrop-blur-sm shadow-2xl border-0">
            <CardHeader className="text-center">
              <div className="flex justify-center items-center gap-3 mb-2">
                <ShoppingCart className="w-7 h-7 text-green-600" />
                <CardTitle className="text-2xl font-bold text-slate-800">
                  {editingSale ? `${t('editing_sale')} #${editingSale.shopify_order_number || t('unknown_order_number')}` : t('sales_registration_station')}
                </CardTitle>
              </div>
              <p className="text-slate-500">{editingSale ? t('modify_sale_details_prompt') : t('register_sales_quickly')}</p>
            </CardHeader>
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="shopify_order_number" className="text-slate-600">{t('order_number')}</Label>
                  <Input
                    id="shopify_order_number"
                    value={nextOrderNumber}
                    onChange={(e) => setNextOrderNumber(e.target.value)}
                    className="bg-white/70 font-mono text-lg h-12 text-center"
                    disabled={isRegistering}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rfid_code" className="text-slate-600">
                    {t('scan_dinosaur_rfid')}
                    {rfid && !error?.type?.startsWith('not_found') && !error?.type?.startsWith('already_sold') && !error?.type?.startsWith('not_available') && (
                      <span className="ml-2 text-green-600 font-semibold">✓ {t('rfid_detected_and_available')}</span>
                    )}
                     {rfid && error && (error.type === 'not_found_with_history' || error.type === 'not_found_no_history' || error.type === 'already_sold' || error.type === 'not_available') && (
                      <span className="ml-2 text-orange-600 font-semibold">⚠ {t('rfid_detected_issue')}</span>
                     )}
                  </Label>
                  <div className="relative">
                    <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="rfid_code"
                      placeholder={t('waiting_for_scan_placeholder')}
                      value={rfidInput}
                      onChange={handleRfidChange}
                      autoComplete="off"
                      className="pl-10 bg-white font-mono text-lg h-12 disabled:bg-slate-100"
                      disabled={isRegistering || !!editingSale || !activeWarehouse?.id} // Disable RFID input if no active warehouse
                    />
                  </div>
                  {rfidInput.length > 0 && rfidInput.length < RFID_CODE_LENGTH && (
                    <p className="text-xs text-slate-500 mt-1">
                      {t('scanning_in_progress', { current: rfidInput.length, total: RFID_CODE_LENGTH })}
                    </p>
                  )}
                  {rfid && (
                    <div className={`p-3 mt-2 rounded-lg ${error ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'}`}>
                      <p className={`text-sm font-medium ${error ? 'text-orange-700' : 'text-green-700'}`}>{t('confirmed_rfid_label')}</p>
                      <p className="font-mono text-xs break-all">{rfid}</p>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-slate-600">{t('additional_notes_optional')}</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('sale_comments_placeholder')}
                    className="bg-white/70"
                    disabled={isRegistering || !activeWarehouse?.id} // Disable if no active warehouse
                  />
                </div>
                
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex flex-col gap-3 p-4 bg-red-50 border border-red-200 rounded-lg"
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-800 mb-2">{
                              error.type === 'interference' ? t('rfid_interference_title') :
                              error.type === 'scan_error' ? t('rfid_scan_error_title') :
                              error.type === 'not_found_with_history' || error.type === 'not_found_no_history' ? t('dino_not_found_title') :
                              error.type === 'already_sold' ? t('dino_already_sold_title') :
                              error.type === 'not_available' ? t('dino_not_available_title') :
                              t('general_error_title')
                          }</p>
                          <p className="text-sm text-red-700">{error.message}</p>
                        </div>
                      </div>
                      
                      {showForceRegisterButtons && ( // Only show force register if relevant error type
                        <div className="flex gap-3 pt-3 border-t border-red-200 mt-3">
                          <Button 
                            type="button" 
                            onClick={handleForceRegister}
                            disabled={isRegistering || !activeWarehouse?.id} // Disable if no active warehouse
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                          >
                            {isRegistering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            {t('continue_anyway_button')}
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={handleCancelForce}
                            disabled={isRegistering || !activeWarehouse?.id} // Disable if no active warehouse
                            className="border-red-200 text-red-700 hover:bg-red-50"
                          >
                            {t('cancel_button')}
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-col gap-3">
                    <Button
                      type="submit"
                      className="w-full h-14 text-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg"
                      disabled={isSubmitDisabled} // Use new helper variable
                    >
                      {isRegistering ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <>{editingSale ? t('update_sale_button') : t('register_sale_button')}</>
                      )}
                    </Button>
                    {editingSale && (
                        <Button type="button" variant="ghost" onClick={handleCancelEdit} className="text-slate-600">
                            <X className="w-4 h-4 mr-2" />
                            {t('cancel_edit_button')}
                        </Button>
                    )}
                </div>
                {!activeWarehouse?.id && (
                  <p className="text-red-500 text-center">{t('no_warehouse_selected_error')}</p>
                )}
              </form>
            </CardContent>
          </Card>
        </motion.div>
        
        <AnimatePresence>
        {lastSale && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onAnimationComplete={() => setTimeout(() => setLastSale(null), 3000)}
            className="p-4 bg-green-100 border border-green-200 text-green-800 rounded-lg shadow-md flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5" />
              <p className="font-medium">
                {lastSale.shopify_order_number?.includes(`(${t('deleted')})`) ? t('sale_deleted_success') : (editingSale ? t('sale_updated_success') : t('sale_registered_success'))}
                <span className="font-mono bg-white/70 px-1 rounded">{lastSale.shopify_order_number || t('unknown_order_number')}</span> 
                {' '}{t('with_rfid_label')}{' '}
                <span className="font-mono bg-white/70 px-1 rounded">{lastSale.dinosaur_rfid}</span>
              </p>
            </div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Recent Sales List */}
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
        >
            <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-700">
                        <History className="w-5 h-5"/>
                        {t('recent_sales_title')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {recentSales.length > 0 ? (
                        <SalesList sales={recentSales} onEdit={handleEdit} onDelete={handleDeleteSale} />
                    ) : (
                        <p className="text-slate-500 text-center py-4">{t('no_recent_sales_message')}</p>
                    )}
                </CardContent>
            </Card>
        </motion.div>
      </div>
    </div>
  );
}
