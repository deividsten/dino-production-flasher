import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layers, Edit, Trash2, Calendar, FileText, Package, Copy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { useLanguage } from "@/components/LanguageProvider";

const colorShades = [
  'bg-red-100 text-red-800', 'bg-blue-100 text-blue-800', 'bg-green-100 text-green-800',
  'bg-yellow-100 text-yellow-800', 'bg-purple-100 text-purple-800', 'bg-pink-100 text-pink-800',
  'bg-indigo-100 text-indigo-800', 'bg-teal-100 text-teal-800'
];

export default function DinosaurVersionsList({ versions, components = [], dinosaurCounts, onEdit, onDelete, onDuplicate }) {
  const { t } = useLanguage();
  const [expandedId, setExpandedId] = useState(null);

  // Helper function to get component name by ID
  const getComponentName = (componentId) => {
    const component = components.find(c => c.id === componentId);
    return component?.name || componentId;
  };

  // Helper function to get tracking type label
  const getTrackingTypeLabel = (trackingType) => {
    return trackingType === 'lote' ? t('by_batch') : 
           trackingType === 'unidad' ? t('by_unit') : 
           t('no_tracking');
  };

  if (versions.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
        <CardContent className="p-12 text-center">
          <Layers className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-600 mb-2">
            {t('no_versions_created')}
          </h3>
          <p className="text-slate-500">
            {t('create_first_version')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {versions.map((version) => {
        const dinoCount = dinosaurCounts[version.id]?.total || 0;
        const colorStats = dinosaurCounts[version.id]?.colors || {};
        const isInUse = dinoCount > 0;

        return (
          <motion.div
            key={version.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            layout
          >
            <Card className="bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 border-0 overflow-hidden">
              <div className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                  <div className="flex items-center gap-4 mb-4 md:mb-0">
                    <div className="p-3 rounded-lg bg-purple-100">
                      <Layers className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">{version.model_name}</h3>
                      <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                        <Calendar className="w-4 h-4" />
                        <span>{t('created_on')} {format(new Date(version.created_date), "MM/dd/yyyy")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onDuplicate(version)}
                            className="bg-white/70"
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            {t('duplicate')}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t('create_editable_copy')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(version)}
                      className="bg-white/70"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      {t('edit')}
                    </Button>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                           <span tabIndex={isInUse ? 0 : -1}>
                            <Button
                              variant="destructive-outline"
                              size="sm"
                              onClick={() => !isInUse && onDelete(version)}
                              disabled={isInUse}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {t('delete')}
                            </Button>
                          </span>
                        </TooltipTrigger>
                         {isInUse && (
                          <TooltipContent>
                             <p>{t('cannot_delete_version_has_dinosaurs')}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(expandedId === version.id ? null : version.id)}
                    >
                      {expandedId === version.id ? t('hide_details') : t('show_details')}
                    </Button>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {expandedId === version.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-slate-50/70 border-t"
                  >
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                          <Package className="w-5 h-5" />
                          {t('components_count', { count: version.components?.length || 0 })}
                        </h4>
                        {version.components && version.components.length > 0 ? (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                            {version.components.map((comp, index) => (
                              <div key={index} className="text-sm bg-white p-2 rounded-md shadow-sm">
                                <p className="font-semibold">{getComponentName(comp.component_id)}</p>
                                <p className="text-slate-600 text-xs">
                                  {t('tracking')}: {getTrackingTypeLabel(comp.tracking_type)}
                                </p>
                                <p className="text-xs text-slate-500 italic mt-1">
                                  {t('batches_selected_in_wip')}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">{t('no_components_configured')}</p>
                        )}
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                          <FileText className="w-5 h-5" />
                          {t('notes')}
                        </h4>
                        <p className="text-sm text-slate-600 bg-white p-3 rounded-md shadow-sm min-h-[4rem]">
                          {version.notes || t('no_notes_version')}
                        </p>
                      </div>

                      <div>
                          <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>
                              {t('units_made', { count: dinoCount })}
                          </h4>
                          {dinoCount > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                  {Object.entries(colorStats).map(([color, count], index) => (
                                      <Badge key={color} className={`capitalize ${colorShades[index % colorShades.length]}`}>
                                          {color}: {count}
                                      </Badge>
                                  ))}
                              </div>
                          ) : (
                              <p className="text-sm text-slate-500">{t('no_dinosaurs_registered_version')}</p>
                          )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}