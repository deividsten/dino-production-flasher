
import React, { useState, useEffect } from "react";
import { Component } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, Search, Filter, Grid3x3, List } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/components/LanguageProvider";
import { useWarehouse } from "@/components/WarehouseProvider";

import ComponentForm from "../components/components/ComponentForm";
import ComponentsList from "../components/components/ComponentsList";

export default function Components() {
  const { t } = useLanguage();
  const { activeWarehouse, filterByWarehouse } = useWarehouse();
  const [components, setComponents] = useState([]);
  const [editingComponent, setEditingComponent] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [trackingFilter, setTrackingFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grid"); // "grid" or "list"

  useEffect(() => {
    loadComponents();
  }, [activeWarehouse]); // Re-run when activeWarehouse changes

  const loadComponents = async () => {
    const data = await Component.list('-created_date');
    // Filtrar por warehouse
    const filtered = filterByWarehouse(data);
    setComponents(filtered);
  };

  const handleEdit = (component) => {
    setEditingComponent(component);
    setShowForm(true);
  };
  
  const handleAddNew = () => {
    setEditingComponent(null);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingComponent(null);
    loadComponents();
  };

  const handleDelete = async (component) => {
    if (window.confirm(t('confirm_delete_component', { componentName: component.name }))) {
      await Component.delete(component.id);
      loadComponents();
    }
  };

  const filteredComponents = components.filter(component => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    const matchesSearch = searchTerm === "" ||
      (component.name && component.name.toLowerCase().includes(lowerSearchTerm)) ||
      (component.description && component.description.toLowerCase().includes(lowerSearchTerm)) ||
      (component.supplier && component.supplier.toLowerCase().includes(lowerSearchTerm)) ||
      (component.batches && component.batches.some(b => b.batch_number && b.batch_number.toLowerCase().includes(lowerSearchTerm))) ||
      (component.serial_numbers && component.serial_numbers.some(s => s.serial_number && s.serial_number.toLowerCase().includes(lowerSearchTerm)));
        
    const matchesCategory = categoryFilter === "all" || component.category === categoryFilter;
    const matchesTracking = trackingFilter === "all" || component.tracking_type === trackingFilter;
    return matchesSearch && matchesCategory && matchesTracking;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
              {t('component_management')}
            </h1>
            <p className="text-slate-600">{t('manage_parts_components_inventory')}</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full lg:w-auto flex gap-3"
          >
            <Button 
              onClick={handleAddNew}
              className="flex-1 lg:flex-none bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              {t('add_component')}
            </Button>
          </motion.div>
        </div>

        <AnimatePresence>
          {showForm && (
            <ComponentForm
              component={editingComponent}
              onClose={handleCloseForm}
            />
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8"
        >
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder={t('search_components_placeholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white/50"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40 bg-white/50">
                  <SelectValue placeholder={t('category')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all')}</SelectItem>
                  <SelectItem value="chips">{t('chips')}</SelectItem>
                  <SelectItem value="baterias">{t('batteries')}</SelectItem>
                  <SelectItem value="sensores">{t('sensors')}</SelectItem>
                  <SelectItem value="motores">{t('motors')}</SelectItem>
                  <SelectItem value="estructuras">{t('structures')}</SelectItem>
                  <SelectItem value="otros">{t('others')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={trackingFilter} onValueChange={setTrackingFilter}>
                <SelectTrigger className="w-40 bg-white/50">
                  <SelectValue placeholder={t('tracking')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all')}</SelectItem>
                  <SelectItem value="lote">{t('by_batch')}</SelectItem>
                  <SelectItem value="unidad">{t('by_unit')}</SelectItem>
                </SelectContent>
              </Select>
              
              {/* View Mode Toggle */}
              <div className="flex gap-1 bg-white/50 rounded-lg p-1">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("grid")}
                  className={viewMode === "grid" ? "bg-blue-600 hover:bg-blue-700" : ""}
                >
                  <Grid3x3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                  className={viewMode === "list" ? "bg-blue-600 hover:bg-blue-700" : ""}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <ComponentsList 
            components={filteredComponents}
            onEdit={handleEdit}
            onDelete={handleDelete}
            viewMode={viewMode}
          />
        </motion.div>
      </div>
    </div>
  );
}
