import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18nContext";
import { DataStoreProvider } from "@/lib/dataStore";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Inventory from "@/pages/Inventory";
import PointOfSale from "@/pages/PointOfSale";
import Transactions from "@/pages/Transactions";
import Customers from "@/pages/Customers";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Suppliers from "@/pages/Suppliers";
import Expenses from "@/pages/Expenses";
import Login from "@/pages/Login";
import NotFound from "./pages/NotFound";
import { seedDemoData, checkAndNotifyLowStock, getSettings } from "@/lib/storage";
import { getLocale, setLocale } from "@/lib/i18n";
import { useEffect } from "react";

seedDemoData();

// Apply saved theme and locale on app start
const savedSettings = getSettings();
if (savedSettings.theme === 'dark') {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}
// Sync locale from settings to i18n system
const savedLocale = savedSettings.language || getLocale();
setLocale(savedLocale);

const queryClient = new QueryClient();

function AuthenticatedApp() {
  const { user } = useAuth();

  useEffect(() => {
    // Check low stock on initial load and every 30 minutes
    if (user) {
      checkAndNotifyLowStock();
      const interval = setInterval(checkAndNotifyLowStock, 30 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  if (!user) return <Login />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/pos" element={<PointOfSale />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <I18nProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <DataStoreProvider>
            {/* opt into upcoming v7 behaviors to silence warnings and get early access */}
            <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <AuthenticatedApp />
            </HashRouter>
          </DataStoreProvider>
        </AuthProvider>
      </I18nProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
