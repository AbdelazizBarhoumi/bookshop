/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from 'react';
import { useDataStore } from '@/lib/dataStore';
import { useI18n } from '@/lib/i18nContext';
import { useAuth } from '@/lib/auth';
import { CATEGORY_I18N_KEYS, CATEGORY_ICONS, type ProductCategory, type BuiltInCategory, getCategoryIcon, getCategoryLabel } from '@/types/pos';
import { Package, TrendingUp, AlertTriangle, ShoppingCart, DollarSign, BarChart3, Receipt } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Link } from 'react-router-dom';

const CHART_COLORS = [
  'hsl(220, 60%, 35%)',
  'hsl(38, 92%, 50%)',
  'hsl(152, 60%, 40%)',
  'hsl(0, 72%, 51%)',
  'hsl(280, 60%, 50%)',
];

export default function Dashboard() {
  const { products, transactions, expenses, settings } = useDataStore();
  const { t, formatCurrency, locale } = useI18n();
  const { user } = useAuth();

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.goodMorning');
    if (hour < 18) return t('dashboard.goodAfternoon');
    return t('dashboard.goodEvening');
  }, [t]);

  const stats = useMemo(() => {
    const totalProducts = products.length;
    const totalStock = products.reduce((s, p) => s + p.quantity, 0);
    const lowStock = products.filter(p => p.quantity <= p.lowStockThreshold && p.category !== 'services');
    const todayStr = new Date().toDateString();
    const todayTx = transactions.filter(t => new Date(t.timestamp).toDateString() === todayStr);
    const todayRevenue = todayTx.reduce((s, t) => s + t.total, 0);
    const totalRevenue = transactions.filter(t => !t.refunded).reduce((s, t) => s + t.total, 0);
    const totalCOGS = transactions.filter(t => !t.refunded).reduce((s, t) => s + t.items.reduce((is, item) => is + item.product.cost * item.quantity, 0), 0);
    const inventoryValue = products.reduce((s, p) => s + (p.price * p.quantity), 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const pendingExpenses = expenses.filter(e => e.paymentStatus === 'pending');
    const pendingExpenseAmount = pendingExpenses.reduce((s, e) => s + e.amount, 0);
    const netProfit = totalRevenue - totalCOGS - totalExpenses;
    return { totalProducts, totalStock, lowStock, todayRevenue, totalRevenue, todayTx, inventoryValue, netProfit, totalExpenses, pendingExpenseCount: pendingExpenses.length, pendingExpenseAmount };
  }, [products, transactions, expenses]);

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + p.quantity;
    });
    return Object.entries(counts).map(([cat, value]) => ({
      name: (cat in CATEGORY_I18N_KEYS) ? t(CATEGORY_I18N_KEYS[cat as BuiltInCategory]) : getCategoryLabel(cat, settings.customCategories, settings.language),
      value,
    }));
  }, [products, t]);

  const recentSalesData = useMemo(() => {
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      const dayTx = transactions.filter(t => new Date(t.timestamp).toDateString() === dateStr);
      const total = dayTx.reduce((s, t) => s + t.total, 0);
      last7.push({
        day: d.toLocaleDateString(locale === 'ar' ? 'ar' : 'en', { weekday: 'short' }),
        revenue: Math.round(total),
      });
    }
    return last7;
  }, [transactions, locale]);

  const statCards = [
    { label: t('dashboard.todayRevenue'), value: formatCurrency(stats.todayRevenue), icon: DollarSign, color: 'text-success' },
    { label: t('dashboard.todaySales'), value: stats.todayTx.length, icon: ShoppingCart, color: 'text-primary' },
    { label: t('dashboard.totalProducts'), value: stats.totalProducts, icon: Package, color: 'text-accent' },
    { label: t('dashboard.lowStockItems'), value: stats.lowStock.length, icon: AlertTriangle, color: stats.lowStock.length > 0 ? 'text-destructive' : 'text-muted-foreground' },
    { label: t('dashboard.netProfit'), value: formatCurrency(stats.netProfit), icon: TrendingUp, color: stats.netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive' },
    { label: t('dashboard.pendingExpenses'), value: `${stats.pendingExpenseCount} · ${formatCurrency(stats.pendingExpenseAmount)}`, icon: Receipt, color: stats.pendingExpenseCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground' },
  ];

  // Recent transactions (last 5)
  const recentTx = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);
  }, [transactions]);

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">
          {greeting}{user?.displayName ? `, ${user.displayName}` : ''} 👋
        </h1>
        <p className="text-muted-foreground text-sm">{t('dashboard.overview')}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((s, i) => (
          <div key={i} className="pos-card p-5 animate-count-up" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold mt-1">{s.value}</p>
              </div>
              <div className={`p-2 rounded-lg bg-muted ${s.color}`}>
                <s.icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="pos-card p-5 lg:col-span-2">
          <h3 className="font-semibold mb-4">{t('dashboard.revenueChart')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={recentSalesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(215, 15%, 48%)" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(215, 15%, 48%)" />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(214, 20%, 90%)', fontSize: '13px' }}
                  formatter={(value: number) => [`${Math.round(value)} ${t('common.currency')}`, t('dashboard.revenue')]}
                />
                <Bar dataKey="revenue" fill="hsl(220, 60%, 35%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="pos-card p-5">
          <h3 className="font-semibold mb-4">{t('dashboard.stockByCategory')}</h3>
          <div className="h-64">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value, t('dashboard.units')]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                {t('dashboard.noProducts')}
              </div>
            )}
          </div>
          <div className="space-y-2 mt-2">
            {categoryData.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                <span className="text-muted-foreground">{c.name}</span>
                <span className="ml-auto font-medium">{c.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {stats.lowStock.length > 0 && (
        <div className="pos-card p-5 border-warning/30">
          <h3 className="font-semibold flex items-center gap-2 text-warning">
            <AlertTriangle size={18} />
            {t('dashboard.lowStockAlerts')}
          </h3>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.lowStock.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <span className="text-lg">{getCategoryIcon(p.category, settings.customCategories)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.quantity} {t('dashboard.left')} · {t('dashboard.threshold')}: {p.lowStockThreshold}</p>
                </div>
                <span className="text-xs font-semibold text-destructive">{p.quantity === 0 ? t('dashboard.out') : t('dashboard.low')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="pos-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{t('dashboard.recentTransactions')}</h3>
            <Link to="/transactions" className="text-xs text-primary hover:underline">{t('dashboard.viewAll')}</Link>
          </div>
          {recentTx.length > 0 ? (
            <div className="space-y-3">
              {recentTx.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10 text-primary">
                      <ShoppingCart size={14} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{tx.items.length} {t('dashboard.units')}</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.timestamp).toLocaleString(locale === 'ar' ? 'ar' : 'en', { dateStyle: 'short', timeStyle: 'short' })}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${tx.refunded ? 'text-destructive line-through' : ''}`}>
                    {formatCurrency(tx.total)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
              {t('dashboard.noRecentSales')}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="pos-card p-5">
          <h3 className="font-semibold mb-4">{t('dashboard.quickActions')}</h3>
          <div className="space-y-2">
            <Link to="/pos" className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors group">
              <ShoppingCart size={18} className="text-primary" />
              <span className="text-sm font-medium group-hover:text-primary transition-colors">{t('nav.pos')}</span>
            </Link>
            <Link to="/inventory" className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors group">
              <Package size={18} className="text-primary" />
              <span className="text-sm font-medium group-hover:text-primary transition-colors">{t('nav.inventory')}</span>
            </Link>
            <Link to="/reports" className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors group">
              <BarChart3 size={18} className="text-primary" />
              <span className="text-sm font-medium group-hover:text-primary transition-colors">{t('nav.reports')}</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
