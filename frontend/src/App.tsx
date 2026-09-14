import React, { Suspense } from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { AppShell } from './components/layout/AppShell';
import { PageLoader } from './components/ui/Loader';

// Lazy load pages for better performance
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const MapView = React.lazy(() => import('./pages/MapView'));
const Scanner = React.lazy(() => import('./pages/Scanner'));
const RiskRadar = React.lazy(() => import('./pages/RiskRadar'));
const PestMonitor = React.lazy(() => import('./pages/PestMonitor'));
const Settings = React.lazy(() => import('./pages/Settings'));
const AuthPage = React.lazy(() => import('./pages/AuthPage'));
const OfficerDesk = React.lazy(() => import('./pages/OfficerDesk'));
const Alerts = React.lazy(() => import('./pages/Alerts'));
const KnowledgeCenter = React.lazy(() => import('./pages/KnowledgeCenter'));
const AIAssistant = React.lazy(() => import('./pages/AIAssistant'));
const HotspotsMap = React.lazy(() => import('./pages/HotspotsMap'));

function AuthenticatedShell() {
  const token = useAuthStore((state) => state.token);
  return token ? <AppShell /> : <Navigate to="/login" replace />;
}

function HomeRoute() {
  const user = useAuthStore((state) => state.user);
  return user?.role === 'OFFICER' ? <Navigate to="/officer" replace /> : <Dashboard />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route element={<AuthenticatedShell />}>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/scanner" element={<Scanner />} />
            <Route path="/risk" element={<RiskRadar />} />
            <Route path="/pests" element={<PestMonitor />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/knowledge" element={<KnowledgeCenter />} />
            <Route path="/assistant" element={<AIAssistant />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/officer" element={<OfficerDesk />} />
            <Route path="/hotspots" element={<HotspotsMap />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
