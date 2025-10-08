import React from 'react';
import { motion } from 'framer-motion';
import { ClipboardList } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

import PurchaseOrders from '@/components/inventory/PurchaseOrders';

export default function InventoryManagement() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-indigo-600" />
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                {t('purchase_orders')}
              </h1>
              <p className="text-slate-600">{t('create_and_manage_pos')}</p>
            </div>
          </div>
        </motion.div>

        <PurchaseOrders />
      </div>
    </div>
  );
}