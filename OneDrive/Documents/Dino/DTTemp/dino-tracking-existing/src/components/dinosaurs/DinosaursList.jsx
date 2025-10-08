import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Calendar, User, Hash, Cpu, CheckCircle, AlertTriangle, Wrench, XCircle, HelpCircle } from 'lucide-react';
import { useLanguage } from "@/components/LanguageProvider";

const statusColors = {
  available: 'bg-green-100 text-green-800 border-green-200',
  sold: 'bg-red-100 text-red-800 border-red-200',
  maintenance: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  damaged: 'bg-orange-100 text-orange-800 border-orange-200',
  unverified: 'bg-gray-100 text-gray-800 border-gray-200',
};

const statusConfig = {
  available: { icon: CheckCircle, gradient: 'bg-gradient-to-r from-green-400 to-emerald-600', bg: 'bg-green-100', color: 'text-green-600' },
  sold: { icon: XCircle, gradient: 'bg-gradient-to-r from-red-400 to-rose-600', bg: 'bg-red-100', color: 'text-red-600' },
  maintenance: { icon: Wrench, gradient: 'bg-gradient-to-r from-yellow-400 to-amber-600', bg: 'bg-yellow-100', color: 'text-yellow-600' },
  damaged: { icon: AlertTriangle, gradient: 'bg-gradient-to-r from-orange-400 to-red-600', bg: 'bg-orange-100', color: 'text-orange-600' },
  unverified: { icon: HelpCircle, gradient: 'bg-gradient-to-r from-gray-400 to-slate-600', bg: 'bg-gray-100', color: 'text-gray-600' },
};

export default function DinosaursList({ dinosaurs, versions = [], onEdit, onDelete }) {
  const { t, language } = useLanguage();

  if (!dinosaurs || dinosaurs.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
        <CardContent className="p-12 text-center">
          <div className="text-6xl mb-4">🦖</div>
          <h3 className="text-xl font-semibold text-slate-600 mb-2">
            {t('no_dinosaurs_registered')}
          </h3>
          <p className="text-slate-500">
            {t('start_adding_first_component')}
          </p>
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
        const StatusIcon = statusConfig[dinosaur.status]?.icon || AlertTriangle;
        
        return (
          <motion.div
            key={dinosaur.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 border-0 overflow-hidden">
              <div className={`h-2 ${statusConfig[dinosaur.status]?.gradient || 'bg-gradient-to-r from-gray-400 to-gray-600'}`} />
              
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${statusConfig[dinosaur.status]?.bg || 'bg-gray-100'}`}>
                      <StatusIcon className={`w-6 h-6 ${statusConfig[dinosaur.status]?.color || 'text-gray-600'}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">
                        {version?.model_name || "Unknown Version"}
                      </h3>
                      {dinosaur.color && (
                        <Badge variant="outline" className="mt-1 capitalize" style={{ backgroundColor: (dinosaur.color || 'gray') + '20', borderColor: dinosaur.color || 'gray' }}>
                          {dinosaur.color}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(dinosaur)}
                        className="hover:bg-emerald-100 h-8 w-8"
                        title={t('edit')}
                      >
                        <Edit className="w-4 h-4 text-emerald-600" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(dinosaur)}
                        className="hover:bg-red-100 h-8 w-8"
                        title={t('delete')}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {dinosaur.status && (
                    <Badge className={`${statusColors[dinosaur.status] || statusColors.unverified} border capitalize`}>
                      {t(dinosaur.status)}
                    </Badge>
                  )}
                  {dinosaur.sku_final && (
                    <Badge variant="outline" className="font-mono bg-indigo-50 text-indigo-700 border-indigo-200">
                      {dinosaur.sku_final}
                    </Badge>
                  )}
                </div>

                <div className="space-y-3">
                  {dinosaur.rfid_code && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">RFID:</span>
                      </div>
                      <span className="text-sm font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded">
                        {dinosaur.rfid_code}
                      </span>
                    </div>
                  )}

                  {dinosaur.device_id && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">Device:</span>
                      </div>
                      <span className="text-sm font-mono text-slate-700">
                        {dinosaur.device_id}
                      </span>
                    </div>
                  )}

                  {dinosaur.assembly_date && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">Assembled:</span>
                      </div>
                      <span className="text-sm text-slate-700">
                        {new Date(dinosaur.assembly_date).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })}
                      </span>
                    </div>
                  )}

                  {dinosaur.assembled_by_operator && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">By:</span>
                      </div>
                      <span className="text-sm text-slate-700 font-medium">
                        {dinosaur.assembled_by_operator}
                      </span>
                    </div>
                  )}

                  {dinosaur.notes && (
                    <div className="pt-2 border-t border-slate-200">
                      <p className="text-xs text-slate-600 italic line-clamp-2">
                        {dinosaur.notes}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}