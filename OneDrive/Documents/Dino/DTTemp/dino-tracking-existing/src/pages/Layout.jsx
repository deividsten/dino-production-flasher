

import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart,
  Search, 
  Database,
  ClipboardList,
  Cpu,
  Layers,
  TestTube,
  Users,
  Loader2,
  LogOut, 
  User,
  Cloud, // Added Cloud icon for Firebase Backup
  Warehouse as WarehouseIcon // Added Warehouse icon for WarehouseManagement
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LanguageProvider, useLanguage } from "@/components/LanguageProvider";
import { User as UserEntity } from "@/api/entities"; 
import OperatorLogin from "@/pages/OperatorLogin";
import { WarehouseProvider, useWarehouse } from "@/components/WarehouseProvider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label"; // Import Label for the selector

// Custom Dinosaur Icon Component
const DinosaurIcon = ({ className }) => (
  <div className={cn("flex items-center justify-center", className)}>
    <span className="text-lg">🦖</span>
  </div>
);

const LanguageSelector = () => {
  const { language, setLanguage } = useLanguage();

  const languages = [
    { code: 'es', flag: '🇪🇸' },
    { code: 'en', flag: '🇺🇸' },
    { code: 'zh', flag: '🇨🇳' },
  ];

  return (
    <div className="flex items-center gap-2">
      {languages.map((lang) => (
        <Button
          key={lang.code}
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 rounded-full transition-all duration-200",
            language === lang.code 
              ? 'ring-2 ring-emerald-500 ring-offset-2 scale-110 bg-emerald-50'
              : 'opacity-50 hover:opacity-100 hover:bg-emerald-100'
          )}
          onClick={() => setLanguage(lang.code)}
          title={`Switch to ${lang.code.toUpperCase()}`}
        >
          <span className="text-lg">{lang.flag}</span>
        </Button>
      ))}
    </div>
  );
};

function LayoutContent({ children, currentPageName }) {
  const location = useLocation();
  const { t } = useLanguage();
  const [operator, setOperator] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

  // Check if current page is public (CountdownToChristmas or QuickQC)
  const isPublicPage = currentPageName === "CountdownToChristmas" || currentPageName === "QuickQC";

  // Initialize operator from localStorage only once
  useEffect(() => {
    if (initialized) return;
    
    const initializeAuth = () => {
      try {
        // Get operator from localStorage
        const storedOperator = localStorage.getItem('dinotrack-operator');
        console.log('Stored operator:', storedOperator); // Debug log
        
        if (storedOperator) {
          const operatorData = JSON.parse(storedOperator);
          console.log('Parsed operator:', operatorData); // Debug log
          setOperator(operatorData);
        }
      } catch (error) {
        console.error("Error reading operator from localStorage:", error);
        // Only remove if there's a parse error, not connection error
        localStorage.removeItem('dinotrack-operator');
      }
      
      setInitialized(true);
      setLoading(false);
    };

    // Initialize user and operator
    const loadUser = async () => {
      try {
        const loggedInUser = await UserEntity.me();
        setUser(loggedInUser);
      } catch (error) {
        console.log("User not logged in or error:", error);
      } finally {
        initializeAuth();
      }
    };

    loadUser();
  }, [initialized]);

  const handleLogout = useCallback(() => {
    console.log('Logging out operator due to inactivity or manual action.'); // Debug log
    localStorage.removeItem('dinotrack-operator');
    setOperator(null);
    setInitialized(false); // Reset initialization to allow re-login
  }, []);
  
  // Effect for Idle Timeout
  useEffect(() => {
    let idleTimer;

    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      if (operator) {
        idleTimer = setTimeout(() => {
          handleLogout();
        }, IDLE_TIMEOUT_MS);
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    
    if (operator) {
      events.forEach(event => window.addEventListener(event, resetIdleTimer));
      resetIdleTimer(); // Initial call to start the timer
    }

    return () => {
      clearTimeout(idleTimer);
      events.forEach(event => window.removeEventListener(event, resetIdleTimer));
    };
  }, [operator, handleLogout, IDLE_TIMEOUT_MS]); // This effect depends on the operator state

  const handleLoginSuccess = (operatorData) => {
    console.log('Login success with operator:', operatorData); // Debug log
    if (!operatorData) return;
    
    try {
      // Store operator with a more specific key
      localStorage.setItem('dinotrack-operator', JSON.stringify(operatorData));
      setOperator(operatorData);
      console.log('Operator stored and set successfully'); // Debug log
    } catch (e) {
      console.error("Failed to store operator data:", e);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500 w-12 h-12" />
      </div>
    );
  }
  
  // If it's a public page, render without authentication
  if (isPublicPage) {
    return (
      <div className="min-h-screen w-full">
        {children}
      </div>
    );
  }

  // For non-public pages, require operator authentication
  if (!operator) {
    return <OperatorLogin onLoginSuccess={handleLoginSuccess} />;
  }
  
  const allNavItems = [
    { name: 'dashboard', title: t('dashboard'), url: createPageUrl("CountdownToChristmas"), icon: LayoutDashboard, color: "text-emerald-600" },
    { name: 'warehouse_management', title: 'Warehouses', url: createPageUrl("WarehouseManagement"), icon: WarehouseIcon, color: "text-purple-600" },
    { name: 'components', title: t('components'), url: createPageUrl("Components"), icon: Package, color: "text-blue-600" },
    { name: 'versions', title: t('versions'), url: createPageUrl("DinosaurVersions"), icon: Layers, color: "text-purple-600" },
    { name: 'wip_loading', title: t('wip_loading'), url: createPageUrl("WIPLoading"), icon: ClipboardList, color: "text-indigo-600" },
    { name: 'dinosaurs', title: t('dinosaurs'), url: createPageUrl("Dinosaurs"), icon: DinosaurIcon, color: "text-emerald-600" },
    { name: 'devices', title: t('devices'), url: createPageUrl("Devices"), icon: Cpu, color: "text-orange-600" },
    { name: 'inventory_management', title: t('inventory_management'), url: createPageUrl("InventoryManagement"), icon: ClipboardList, color: "text-indigo-600" },
    { name: 'quality_control', title: t('quality_control'), url: createPageUrl("QualityControl"), icon: TestTube, color: "text-red-600" },
    { name: 'sales', title: t('sales'), url: createPageUrl("Sales"), icon: ShoppingCart, color: "text-green-600" },
    { name: 'shipping', title: t('shipping'), url: createPageUrl("Shipping"), icon: Package, color: "text-blue-600" },
    { name: 'search', title: t('search'), url: createPageUrl("Search"), icon: Search, color: "text-purple-600" },
    { name: 'operator_management', title: t('operator_management'), url: createPageUrl("OperatorManagement"), icon: Users, color: "text-pink-600" },
    { name: 'slack_bot_diagnostics', title: 'Slack Bot Logs', url: createPageUrl("SlackBotDiagnostics"), icon: Database, color: "text-cyan-600" },
    { name: 'firebase_backup', title: 'Firebase Backup', url: createPageUrl("FirebaseBackup"), icon: Cloud, color: "text-orange-600" },
  ];
  
  const navigationItems = allNavItems.filter(item => {
    if (operator?.is_admin) return true;
    return operator?.permissions?.includes(item.name);
  });

  return (
    <SidebarProvider>
      <style>{`
        [id^="base44-edit-"] {
          display: none !important;
        }
      `}</style>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 to-emerald-50">
        <Sidebar className="border-r border-emerald-100 bg-white/80 backdrop-blur-sm">
          <SidebarHeader className="border-b border-emerald-100 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center shadow-lg">
                  <DinosaurIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                    DinoTrack
                  </h1>
                  <p className="text-xs text-slate-500">{t('inventory_manager')}</p>
                </div>
              </div>
            </div>
            
            <LanguageSelector />
            
            {/* Warehouse Selector - SIEMPRE VISIBLE */}
            <div className="mt-4">
              <WarehouseSelector />
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-4">
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === item.url || (location.pathname.startsWith(`${item.url}/`) && item.url !== "/")}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all hover:bg-emerald-50"
                  >
                    <Link to={item.url} className="flex items-center w-full h-full">
                      <item.icon className={`w-5 h-5 ${item.color}`} />
                      <span className="font-medium text-slate-700 ml-3">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          
          <SidebarFooter className="border-t border-emerald-100 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{operator?.name}</p>
                  {operator?.is_admin && (
                    <p className="text-xs text-emerald-600 font-semibold">{t('admin')}</p>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="hover:bg-red-50 hover:text-red-600">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 overflow-auto">
          <div className="h-full">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

function WarehouseSelector() {
  const { warehouses, activeWarehouse, switchWarehouse, isLoading } = useWarehouse();
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-slate-500 uppercase">{t('warehouse')}</Label>
        <div className="h-10 bg-slate-100 animate-pulse rounded-md"></div>
      </div>
    );
  }

  if (warehouses.length === 0) {
    return (
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-slate-500 uppercase">{t('warehouse')}</Label>
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
          <p className="text-xs text-amber-800 font-medium">⚠️ {t('no_warehouses_configured')}</p>
          <Link to={createPageUrl("WarehouseManagement")} className="text-xs text-amber-600 hover:underline mt-1 block">
            {t('create_warehouse')} →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
        <WarehouseIcon className="w-3 h-3" />
        {t('active_warehouse')}
      </Label>
      <Select
        value={activeWarehouse?.id || ''}
        onValueChange={(value) => {
          const warehouse = warehouses.find(w => w.id === value);
          if (warehouse) switchWarehouse(warehouse);
        }}
      >
        <SelectTrigger className="bg-white border-emerald-200 hover:border-emerald-300">
          <SelectValue placeholder={t('select_warehouse')} />
        </SelectTrigger>
        <SelectContent>
          {warehouses.map(warehouse => (
            <SelectItem key={warehouse.id} value={warehouse.id}>
              <div className="flex items-center gap-2">
                <span className="font-medium">{warehouse.name}</span>
                <span className="text-xs text-slate-500 font-mono">({warehouse.code})</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {activeWarehouse && (
        <p className="text-xs text-slate-500 italic">
          {activeWarehouse.location || t('no_location')}
        </p>
      )}
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <LanguageProvider>
      <WarehouseProvider>
        <style>{`
          /* Hide base44 edit button - comprehensive approach */
          [data-base44-edit],
          [class*="base44-edit"],
          [id*="base44-edit"],
          [data-base44],
          [class*="base44"],
          button[data-base44],
          div[data-base44],
          a[data-base44] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
          
          /* Additional hiding for floating edit buttons */
          button[title*="Edit"],
          button[title*="edit"],
          .floating-edit-button,
          [class*="EditButton"],
          [class*="edit-button"] {
            display: none !important;
            visibility: hidden !important;
          }
          
          /* Hide any fixed/absolute positioned edit buttons in bottom corner */
          body > div[style*="position: fixed"][style*="bottom"],
          body > button[style*="position: fixed"][style*="bottom"],
          body > div[style*="position: absolute"][style*="bottom"] {
            display: none !important;
            visibility: hidden !important;
          }
          
          /* Hide elements that might contain base44 in their attributes */
          [class*="Base44"],
          [id*="Base44"] {
            display: none !important;
            visibility: hidden !important;
          }
          
          /* Hide any iframe-related edit buttons */
          button[aria-label*="edit"],
          button[aria-label*="Edit"],
          a[aria-label*="edit"],
          a[aria-label*="Edit"] {
            display: none !important;
            visibility: hidden !important;
          }
        `}</style>
        <LayoutContent children={children} currentPageName={currentPageName} />
      </WarehouseProvider>
    </LanguageProvider>
  );
}

