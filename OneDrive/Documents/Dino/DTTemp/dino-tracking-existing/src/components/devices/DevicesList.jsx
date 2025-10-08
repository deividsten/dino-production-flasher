
import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cpu, Edit, Hash, Calendar, CheckCircle, Clock, AlertTriangle, Trash2, ClipboardList, User } from "lucide-react";


const statusColors = {
  "ready": "bg-green-100 text-green-800 border-green-200",
  "used": "bg-blue-100 text-blue-800 border-blue-200",
  "defective": "bg-red-100 text-red-800 border-red-200"
};

const statusIcons = {
  "ready": <CheckCircle className="w-4 h-4 text-green-600" />,
  "used": <Clock className="w-4 h-4 text-blue-600" />,
  "defective": <AlertTriangle className="w-4 h-4 text-red-600" />
};

export default function DevicesList({ devices, versions = [], onEdit, onDelete, onViewDetails }) {
  if (!devices || devices.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
        <CardContent className="p-12 text-center">
          <Cpu className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-600 mb-2">
            No devices found
          </h3>
          <p className="text-slate-500">
            Devices will appear here once you register the first one
          </p>
        </CardContent>
      </Card>
    );
  }

  // Create a lookup map for versions with safety check
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
        
        return (
          <motion.div
            key={device.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card 
              className="bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 border-0 overflow-hidden cursor-pointer"
              onClick={() => onViewDetails(device)}
            >
              <div className="h-1 bg-gradient-to-r from-purple-400 to-indigo-600" />
              
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100">
                      <Cpu className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">
                        {version?.model_name || "Unknown Version"}
                      </h3>
                      <p className="text-sm text-slate-500">
                        Device: {device.device_id}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); onEdit(device); }}
                        className="hover:bg-purple-100 h-8 w-8"
                      >
                        <Edit className="w-4 h-4 text-purple-600" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); onDelete(device); }}
                        className="hover:bg-red-100 h-8 w-8"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge className={`${statusColors[device.status]} border flex items-center gap-1`}>
                    {statusIcons[device.status]}
                    {device.status.charAt(0).toUpperCase() + device.status.slice(1)}
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <ClipboardList className="w-3 h-3" />
                    {device.components_used?.length || 0} Components
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-600">Device ID:</span>
                    </div>
                    <span className="text-sm font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded">
                      {device.device_id}
                    </span>
                  </div>

                  {device.assembly_date && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">Assembled:</span>
                      </div>
                      <span className="text-sm text-slate-700">
                        {new Date(device.assembly_date).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })}
                      </span>
                    </div>
                  )}

                  {device.assembled_by_operator && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">By:</span>
                      </div>
                      <span className="text-sm text-slate-700 font-medium">
                        {device.assembled_by_operator}
                      </span>
                    </div>
                  )}

                  {device.notes && (
                    <div className="pt-2 border-t border-slate-200">
                      <p className="text-xs text-slate-600 italic line-clamp-2">
                        {device.notes}
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
