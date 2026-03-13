import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18nContext";
import { DataStoreProvider } from "@/lib/dataStore";
import AppLayout from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Dashboard from "@/pages/Dashboard";
import Inventory from "@/pages/Inventory";
import Products from "@/pages/Products";
import PointOfSale from "@/pages/PointOfSale";
import Transactions from "@/pages/Transactions";
import Customers from "@/pages/Customers";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Suppliers from "@/pages/Suppliers";
import Expenses from "@/pages/Expenses";
import Login from "@/pages/Login";
import NotFound from "./pages/NotFound";
import {
  initializeStorage,
  seedDemoData,
  checkAndNotifyLowStock,
  getSettings,
} from "@/lib/storage";
import { getLocale, setLocale } from "@/lib/i18n";
import { useEffect, useState } from "react";

const queryClient = new QueryClient();

function AuthenticatedApp() {
  const { user } = useAuth();

  useEffect(() => {
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
        <Route path="/" element={<ProtectedRoute permission="dashboard"><Dashboard /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute permission="products"><Products /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute permission="inventory"><Inventory /></ProtectedRoute>} />
        <Route path="/pos" element={<ProtectedRoute permission="pos"><PointOfSale /></ProtectedRoute>} />
        <Route path="/transactions" element={<ProtectedRoute permission="transactions"><Transactions /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute permission="customers"><Customers /></ProtectedRoute>} />
        <Route path="/suppliers" element={<ProtectedRoute permission="suppliers"><Suppliers /></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute permission="expenses"><Expenses /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute permission="reports"><Reports /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute permission="settings"><Settings /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function boot() {
      // 1. Load data from SQLite (or migrate from localStorage)
      await initializeStorage();

      // 2. Seed demo data if needed (synchronous – operates on in-memory arrays)
      seedDemoData();

      // 3. Apply saved theme + locale
      const savedSettings = getSettings();
      if (savedSettings.theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      setLocale(savedSettings.language || getLocale());

      setReady(true);
    }
    boot();
  }, []);

  if (!ready) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <I18nProvider>
          <Toaster />
          <Sonner />
          <AuthProvider>
            <DataStoreProvider>
              <HashRouter
                future={{
                  v7_startTransition: true,
                  v7_relativeSplatPath: true,
                }}
              >
                <AuthenticatedApp />
              </HashRouter>
            </DataStoreProvider>
          </AuthProvider>
        </I18nProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
