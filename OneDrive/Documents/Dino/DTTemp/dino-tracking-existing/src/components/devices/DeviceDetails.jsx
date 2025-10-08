
import React from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Cpu, Calendar, Hash, ClipboardList, CheckCircle, Clock, AlertTriangle, X, Tag } from 'lucide-react';
// format import is no longer needed after switching to toLocaleString

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

export default function DeviceDetails({ device, versions, onClose }) {
  const version = versions.find(v => v.id === device.version_id);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white/90 backdrop-blur-lg p-0">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <DialogHeader className="p-6 bg-slate-50 rounded-t-lg">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-100">
                <Cpu className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-800">
                  Device Details
                </DialogTitle>
                <DialogDescription className="font-mono text-purple-700 bg-purple-100 px-2 py-1 rounded-md inline-block mt-1">
                  {device.device_id}
                </DialogDescription>
              </div>
            </div>
             <DialogClose asChild>
                <Button variant="ghost" size="icon" className="absolute top-4 right-4 rounded-full h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
            </DialogClose>
          </DialogHeader>

          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-500">Model Version</p>
                <p className="font-semibold text-slate-700">{version?.model_name || 'Unknown'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-500">Assembly Date</p>
                <p className="font-semibold text-slate-700">
                  {new Date(device.assembly_date).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-500">Status</p>
                <Badge className={`${statusColors[device.status]} border flex items-center gap-1 w-fit`}>
                  {statusIcons[device.status]}
                  {device.status.charAt(0).toUpperCase() + device.status.slice(1)}
                </Badge>
              </div>
            </div>

            {device.notes && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-500">Assembly Notes</p>
                <div className="p-3 bg-slate-50 rounded-md border text-slate-600 text-sm italic">
                  {device.notes}
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-purple-600" />
                Bill of Materials Used ({device.components_used?.length || 0})
              </h4>
              <div className="space-y-2 rounded-lg bg-slate-50 border max-h-60 overflow-y-auto p-4">
                {device.components_used?.map((comp, index) => (
                  <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{comp.component_name}</p>
                      <Badge variant="outline" className="mt-1 capitalize text-xs">
                        {comp.tracking_type === 'lote' ? 'Tracked by Batch' : 'Tracked by Unit'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-sm text-purple-800 bg-purple-100 px-3 py-1.5 rounded-full">
                      <Tag className="w-4 h-4"/>
                      <span>{comp.tracking_type === 'lote' ? comp.batch_number : comp.serial_number}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
