
import React, { useState, useEffect } from "react";
import { Component, Dinosaur, Sale } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Skull, ShoppingCart, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageProvider";
import { useWarehouse } from "@/components/WarehouseProvider"; // Added import

export default function Dashboard() {
  const { t } = useLanguage();
  const { filterByWarehouse } = useWarehouse(); // Added useWarehouse hook
  const [stats, setStats] = useState({
    components: 0,
    dinosaurs: 0,
    sales: 0,
    availableDinos: 0,
    lowStock: 0,
    recentSales: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [recentItems, setRecentItems] = useState({
    components: [],
    dinosaurs: [],
    sales: []
  });

  useEffect(() => {
    loadDashboardData();
  }, [filterByWarehouse]); // Added filterByWarehouse to dependency array to re-run when warehouse changes

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [components, dinosaurs, sales] = await Promise.all([
        Component.list('-created_date', 100),
        Dinosaur.list('-created_date', 100),
        Sale.list('-created_date', 100)
      ]);

      // Filtrar por warehouse
      const filteredComponents = filterByWarehouse(components);
      const filteredDinosaurs = filterByWarehouse(dinosaurs);
      const filteredSales = filterByWarehouse(sales);

      const availableDinos = filteredDinosaurs.filter(d => d.status === 'available').length;
      const lowStock = filteredComponents.filter(c => c.quantity < 10).length;
      const recentSales = filteredSales.filter(s => {
        const saleDate = new Date(s.created_date);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return saleDate > weekAgo;
      }).length;

      setStats({
        components: filteredComponents.length,
        dinosaurs: filteredDinosaurs.length,
        sales: filteredSales.length,
        availableDinos,
        lowStock,
        recentSales
      });

      setRecentItems({
        components: filteredComponents.slice(0, 5),
        dinosaurs: filteredDinosaurs.slice(0, 5),
        sales: filteredSales.slice(0, 5)
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
    setIsLoading(false);
  };

  const statCards = [
    {
      title: t('total_components'),
      value: stats.components,
      icon: Package,
      color: "from-blue-500 to-blue-600",
      textColor: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: t('total_dinosaurs'),
      value: stats.dinosaurs,
      icon: Skull,
      color: "from-emerald-500 to-emerald-600",
      textColor: "text-emerald-600",
      bgColor: "bg-emerald-50"
    },
    {
      title: t('total_sales'),
      value: stats.sales,
      icon: ShoppingCart,
      color: "from-amber-500 to-amber-600",
      textColor: "text-amber-600",
      bgColor: "bg-amber-50"
    },
    {
      title: t('available_dinos'),
      value: stats.availableDinos,
      icon: CheckCircle,
      color: "from-green-500 to-green-600",
      textColor: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: t('low_stock'),
      value: stats.lowStock,
      icon: AlertTriangle,
      color: "from-red-500 to-red-600",
      textColor: "text-red-600",
      bgColor: "bg-red-50"
    },
    {
      title: t('sales_this_week'),
      value: stats.recentSales,
      icon: TrendingUp,
      color: "from-purple-500 to-purple-600",
      textColor: "text-purple-600",
      bgColor: "bg-purple-50"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent mb-2">
            {t('dashboard_title')}
          </h1>
          <p className="text-slate-600 text-lg">
            {t('dashboard_subtitle')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="relative overflow-hidden hover:shadow-xl transition-all duration-300 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${stat.color} opacity-10 rounded-full -translate-y-4 translate-x-4`} />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-600">
                      {stat.title}
                    </CardTitle>
                    <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                      <stat.icon className={`w-4 h-4 ${stat.textColor}`} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-800">
                    {isLoading ? <Skeleton className="h-8 w-16" /> : stat.value}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-700">
                  <Skull className="w-5 h-5" />
                  {t('recent_dinosaurs')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {Array(3).fill(0).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-lg" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-32 mb-1" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentItems.dinosaurs.length > 0 ? (
                  <div className="space-y-3">
                    {recentItems.dinosaurs.map((dino) => (
                      <div key={dino.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-emerald-50 transition-colors">
                        <div className="w-10 h-10 bg-gradient-to-r from-emerald-100 to-emerald-200 rounded-lg flex items-center justify-center">
                          <Skull className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-800">{dino.model_name}</p>
                          <p className="text-sm text-slate-500">{dino.version} - {dino.species}</p>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          dino.status === 'available' ? 'bg-green-100 text-green-800' :
                          dino.status === 'sold' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {t(dino.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-8">{t('no_dinosaurs_registered')}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <Package className="w-5 h-5" />
                  {t('critical_components')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {Array(3).fill(0).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-lg" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-32 mb-1" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentItems.components.filter(c => c.quantity < 10).slice(0, 5).map((component) => (
                      <div key={component.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-red-50 transition-colors">
                        <div className="w-10 h-10 bg-gradient-to-r from-red-100 to-red-200 rounded-lg flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-800">{component.name}</p>
                          <p className="text-sm text-slate-500">Stock: {component.quantity}</p>
                        </div>
                      </div>
                    ))}
                    {recentItems.components.filter(c => c.quantity < 10).length === 0 && (
                      <p className="text-slate-500 text-center py-8">{t('all_components_sufficient_stock')}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
