import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

export default function SalesList({ sales, onEdit, onDelete }) {
  const { language } = useLanguage();

  return (
    <div className="space-y-3">
      {sales.map(sale => (
        <Card key={sale.id} className="bg-slate-50 border-slate-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-baseline gap-3">
                <p className="font-bold text-slate-800">{sale.shopify_order_number}</p>
                <p className="font-mono text-xs text-slate-500">{sale.dinosaur_rfid}</p>
              </div>
              <p className="text-sm text-slate-600 mt-1">{sale.notes}</p>
              <p className="text-xs text-slate-400 mt-2">
                {new Date(sale.created_date).toLocaleString(language === 'es' ? 'es-ES' : language === 'zh' ? 'zh-CN' : 'en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: 'numeric', minute: '2-digit',
                    timeZone: 'America/Los_Angeles'
                })}
              </p>
            </div>
            <div className="flex gap-2">
              {onEdit && (
                <Button variant="ghost" size="icon" onClick={() => onEdit(sale)} className="text-slate-500 hover:text-slate-700 hover:bg-slate-100">
                  <Edit className="w-4 h-4" />
                </Button>
              )}
              {onDelete && (
                <Button variant="ghost" size="icon" onClick={() => onDelete(sale)} className="text-red-500 hover:text-red-700 hover:bg-red-100">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}