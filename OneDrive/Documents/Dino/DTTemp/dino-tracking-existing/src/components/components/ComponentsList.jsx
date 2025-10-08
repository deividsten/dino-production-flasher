import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Edit, User, Hash, List, Layers, Trash2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ComponentsList({ components, onEdit, onDelete, viewMode = "grid" }) {
  const { language } = useLanguage();
  const { t } = useLanguage();

  if (components.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
        <CardContent className="p-12 text-center">
          <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-600 mb-2">
            {t('no_components_registered')}
          </h3>
          <p className="text-slate-500">
            {t('start_adding_first_component')}
          </p>
        </CardContent>
      </Card>
    );
  }

  // List View
  if (viewMode === "list") {
    return (
      <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold">{t('component')}</TableHead>
                  <TableHead className="font-semibold">{t('category')}</TableHead>
                  <TableHead className="font-semibold">{t('tracking')}</TableHead>
                  <TableHead className="font-semibold text-right">{t('current_stock')}</TableHead>
                  <TableHead className="font-semibold">{t('supplier')}</TableHead>
                  <TableHead className="font-semibold text-right">{t('edit')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {components.map((component, index) => (
                  <motion.tr
                    key={component.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          component.tracking_type === 'unidad' ? 'bg-purple-100' : 'bg-blue-100'
                        }`}>
                          <Package className={`w-4 h-4 ${
                            component.tracking_type === 'unidad' ? 'text-purple-600' : 'text-blue-600'
                          }`} />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">{component.name}</div>
                          {component.description && (
                            <div className="text-xs text-slate-500 line-clamp-1">{component.description}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {component.category || 'otros'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        component.tracking_type === 'unidad' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                      }>
                        {component.tracking_type === 'lote' ? t('by_batch') : t('by_unit')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${
                        component.quantity === 0 ? 'bg-red-100 text-red-800' :
                        component.quantity < 10 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {component.quantity}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-600">{component.supplier || '-'}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(component)}
                          className="hover:bg-blue-100 h-8 w-8"
                        >
                          <Edit className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(component)}
                          className="hover:bg-red-100 h-8 w-8"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Grid View (existing)
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {components.map((component, index) => (
        <motion.div
          key={component.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card className="bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 border-0 overflow-hidden">
            <div className={`h-1 bg-gradient-to-r ${
              component.tracking_type === 'unidad' ? 'from-purple-400 to-purple-600' : 'from-blue-400 to-blue-600'
            }`} />
            
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    component.tracking_type === 'unidad' ? 'bg-purple-100' : 'bg-blue-100'
                  }`}>
                    <Package className={`w-5 h-5 ${
                      component.tracking_type === 'unidad' ? 'text-purple-600' : 'text-blue-600'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">{component.name}</h3>
                    <Badge variant="outline" className={`mt-1 ${
                      component.tracking_type === 'unidad' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {component.tracking_type === 'lote' ? t('by_batch') : t('by_unit')}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(component)}
                    className="hover:bg-blue-100 h-8 w-8"
                  >
                    <Edit className="w-4 h-4 text-blue-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(component)}
                    className="hover:bg-red-100 h-8 w-8"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </div>

              {component.description && (
                <p className="text-slate-600 text-sm mb-4 line-clamp-2">
                  {component.description}
                </p>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-600">{t('current_stock')}:</span>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    component.quantity === 0 ? 'bg-red-100 text-red-800' :
                    component.quantity < 10 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {component.quantity} units
                  </div>
                </div>

                {component.tracking_type === 'lote' && component.batches && component.batches.length > 0 && (
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-600">{t('batch')}:</span>
                    </div>
                    <div className="bg-slate-50 rounded p-2 max-h-24 overflow-y-auto space-y-1">
                      {component.batches.slice(0, 3).map((batch, idx) => (
                        <div key={idx} className="text-xs bg-white px-2 py-1 rounded flex justify-between">
                          <div>
                            <div className="font-medium text-slate-700">{batch.batch_number}</div>
                            <div className="text-slate-500">{batch.description}</div>
                            {batch.created_date && (
                              <div className="text-slate-400 text-xs">
                                {new Date(batch.created_date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { timeZone: 'America/Los_Angeles' })}
                              </div>
                            )}
                          </div>
                          <div className="text-slate-600 font-medium">{batch.quantity}</div>
                        </div>
                      ))}
                      {component.batches.length > 3 && (
                        <div className="text-xs text-slate-500 text-center">
                          +{component.batches.length - 3} more batches
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {component.tracking_type === 'unidad' && component.serial_numbers && component.serial_numbers.length > 0 && (
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <List className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-600">Serial Numbers:</span>
                    </div>
                    <div className="bg-slate-50 rounded p-2 max-h-24 overflow-y-auto">
                      <div className="space-y-1">
                        {component.serial_numbers.slice(0, 3).map((serialObj, idx) => (
                          <div key={idx} className="text-xs bg-white px-2 py-2 rounded">
                            <div className="font-mono text-slate-700 font-medium">
                              {typeof serialObj === 'string' ? serialObj : serialObj.serial_number}
                            </div>
                            {typeof serialObj !== 'string' && serialObj.notes && (
                              <div className="text-slate-600 mt-1 italic">
                                {serialObj.notes}
                              </div>
                            )}
                            {typeof serialObj !== 'string' && serialObj.created_date && (
                              <div className="text-slate-400 text-xs mt-1">
                                {new Date(serialObj.created_date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { timeZone: 'America/Los_Angeles' })}
                              </div>
                            )}
                          </div>
                        ))}
                        {component.serial_numbers.length > 3 && (
                          <div className="text-xs text-slate-500 text-center py-1">
                            +{component.serial_numbers.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {component.supplier && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-600">{t('supplier')}:</span>
                    </div>
                    <span className="text-sm font-medium text-slate-700">
                      {component.supplier}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}