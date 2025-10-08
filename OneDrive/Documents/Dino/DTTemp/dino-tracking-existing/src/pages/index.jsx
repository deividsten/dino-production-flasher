import Layout from "./Layout.jsx";

import Dashboard from "./Dashboard";

import Components from "./Components";

import Dinosaurs from "./Dinosaurs";

import Sales from "./Sales";

import Search from "./Search";

import BOMManagement from "./BOMManagement";

import Devices from "./Devices";

import DinosaurVersions from "./DinosaurVersions";

import QualityControl from "./QualityControl";

import InventoryManagement from "./InventoryManagement";

import OperatorManagement from "./OperatorManagement";

import OperatorLogin from "./OperatorLogin";

import WIPLoading from "./WIPLoading";

import Shipping from "./Shipping";

import CountdownToChristmas from "./CountdownToChristmas";

import QuickQC from "./QuickQC";

import SlackBotDiagnostics from "./SlackBotDiagnostics";

import FirebaseBackup from "./FirebaseBackup";

import WarehouseManagement from "./WarehouseManagement";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Dashboard: Dashboard,
    
    Components: Components,
    
    Dinosaurs: Dinosaurs,
    
    Sales: Sales,
    
    Search: Search,
    
    BOMManagement: BOMManagement,
    
    Devices: Devices,
    
    DinosaurVersions: DinosaurVersions,
    
    QualityControl: QualityControl,
    
    InventoryManagement: InventoryManagement,
    
    OperatorManagement: OperatorManagement,
    
    OperatorLogin: OperatorLogin,
    
    WIPLoading: WIPLoading,
    
    Shipping: Shipping,
    
    CountdownToChristmas: CountdownToChristmas,
    
    QuickQC: QuickQC,
    
    SlackBotDiagnostics: SlackBotDiagnostics,
    
    FirebaseBackup: FirebaseBackup,
    
    WarehouseManagement: WarehouseManagement,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Dashboard />} />
                
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/Components" element={<Components />} />
                
                <Route path="/Dinosaurs" element={<Dinosaurs />} />
                
                <Route path="/Sales" element={<Sales />} />
                
                <Route path="/Search" element={<Search />} />
                
                <Route path="/BOMManagement" element={<BOMManagement />} />
                
                <Route path="/Devices" element={<Devices />} />
                
                <Route path="/DinosaurVersions" element={<DinosaurVersions />} />
                
                <Route path="/QualityControl" element={<QualityControl />} />
                
                <Route path="/InventoryManagement" element={<InventoryManagement />} />
                
                <Route path="/OperatorManagement" element={<OperatorManagement />} />
                
                <Route path="/OperatorLogin" element={<OperatorLogin />} />
                
                <Route path="/WIPLoading" element={<WIPLoading />} />
                
                <Route path="/Shipping" element={<Shipping />} />
                
                <Route path="/CountdownToChristmas" element={<CountdownToChristmas />} />
                
                <Route path="/QuickQC" element={<QuickQC />} />
                
                <Route path="/SlackBotDiagnostics" element={<SlackBotDiagnostics />} />
                
                <Route path="/FirebaseBackup" element={<FirebaseBackup />} />
                
                <Route path="/WarehouseManagement" element={<WarehouseManagement />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}