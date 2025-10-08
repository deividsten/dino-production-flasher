import React, { useState, useEffect } from "react";
import { DinosaurVersion, Dinosaur, Component } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";

import DinosaurVersionForm from "../components/dinosaur-versions/DinosaurVersionForm";
import DinosaurVersionsList from "../components/dinosaur-versions/DinosaurVersionsList";

export default function DinosaurVersionsPage() {
  const { t } = useLanguage();
  const [versions, setVersions] = useState([]);
  const [dinosaurs, setDinosaurs] = useState([]);
  const [components, setComponents] = useState([]);
  const [dinosaurCounts, setDinosaurCounts] = useState({});
  
  const [showForm, setShowForm] = useState(false);
  const [editingVersion, setEditingVersion] = useState(null);

  useEffect(() => {
    if (!showForm) {
      loadData();
    }
  }, [showForm]);

  const loadData = async () => {
    const [versionsData, dinosaursData, componentsData] = await Promise.all([
      DinosaurVersion.list('-created_date'),
      Dinosaur.list('-created_date'),
      Component.list('-created_date'),
    ]);
    
    setVersions(versionsData);
    setDinosaurs(dinosaursData);
    setComponents(componentsData);

    const counts = {};
    dinosaursData.forEach(dino => {
      const versionId = dino.version_id;
      if (!counts[versionId]) {
        counts[versionId] = { total: 0, colors: {} };
      }
      counts[versionId].total++;
      const color = dino.color || 'unknown';
      counts[versionId].colors[color] = (counts[versionId].colors[color] || 0) + 1;
    });
    
    setDinosaurCounts(counts);
  };

  const handleShowForm = (versionToEdit = null) => {
    setEditingVersion(versionToEdit);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingVersion(null);
  };

  const handleDeleteVersion = async (version) => {
    const dinoCount = dinosaurCounts[version.id]?.total || 0;
    if (dinoCount > 0) {
      alert(t('cannot_delete_version_has_dinosaurs_with_count', { count: dinoCount }));
      return;
    }
    
    if (window.confirm(t('confirm_delete_version', { name: version.model_name }))) {
      await DinosaurVersion.delete(version.id);
      loadData();
    }
  };

  const handleDuplicateVersion = async (version) => {
    const newName = prompt(t('enter_duplicate_version_name'), `${version.model_name} - ${t('copy')}`);
    
    if (!newName || newName.trim() === '') {
      return;
    }

    if (newName.trim() === version.model_name) {
      alert(t('enter_different_name_duplicate'));
      return;
    }

    try {
      const duplicatedVersion = {
        model_name: newName.trim(),
        components: [...(version.components || [])],
        available_colors: [...(version.available_colors || [])],
        notes: version.notes ? `${version.notes}\n\n[${t('duplicated_from')}: ${version.model_name}]` : `${t('duplicated_from')}: ${version.model_name}`
      };

      await DinosaurVersion.create(duplicatedVersion);
      loadData();
      
      alert(t('version_duplicated_successfully', { newName: newName, originalName: version.model_name }));
    } catch (error) {
      console.error("Error duplicating version:", error);
      alert(t('error_duplicating_version'));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-2">
              {t('dinosaur_versions')}
            </h1>
            <p className="text-slate-600">
              {t('create_manage_configurations')}
            </p>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex gap-3 w-full lg:w-auto">
            <Button onClick={() => handleShowForm()} className="w-full lg:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg">
              <Layers className="w-5 h-5 mr-2" />
              {t('create_version')}
            </Button>
          </motion.div>
        </div>

        <AnimatePresence>
          {showForm && (
            <DinosaurVersionForm
              key={editingVersion ? `v_${editingVersion.id}` : 'new-version'}
              version={editingVersion}
              components={components}
              onCancel={handleCloseForm}
            />
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <DinosaurVersionsList 
            versions={versions}
            components={components}
            dinosaurCounts={dinosaurCounts}
            onEdit={handleShowForm}
            onDelete={handleDeleteVersion}
            onDuplicate={handleDuplicateVersion}
          />
        </motion.div>
      </div>
    </div>
  );
}