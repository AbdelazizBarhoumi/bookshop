import { useState, useMemo } from 'react';
import { useDataStore } from '@/lib/dataStore';
import { useI18n } from '@/lib/i18nContext';
import { Product, Transaction, CATEGORY_LABELS, CATEGORY_ICONS, CATEGORY_I18N_KEYS, type ProductCategory } from '@/types/pos';
import { generateInventoryPDF, generateSalesReportPDF } from '@/lib/pdf';
import { exportProductsCSV, exportTransactionsCSV } from '@/lib/csv';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { FileText, BarChart3, Download, TrendingUp, DollarSign, Package, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['hsl(220, 60%, 35%)', 'hsl(38, 92%, 50%)', 'hsl(152, 60%, 40%)', 'hsl(0, 72%, 51%)', 'hsl(280, 60%, 50%)'];

type TimeRange = '7d' | '30d' | '90d' | 'all';

export default function Reports() {
  const { products, transactions, settings } = useDataStore();
  const { t, formatCurrency, isRTL } = useI18n();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  const filteredTx = useMemo(() => {
    if (timeRange === 'all') return transactions;
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return transactions.filter(tx => new Date(tx.timestamp) >= cutoff);
  }, [transactions, timeRange]);

  // Revenue over time
  const revenueData = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
    const data: { date: string; revenue: number; profit: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      const dayTx = filteredTx.filter(tx => new Date(tx.timestamp).toDateString() === dateStr && !tx.refunded);
      const revenue = dayTx.reduce((s, t) => s + t.total, 0);
      const cost = dayTx.reduce((s, t) => s + t.items.reduce((is, item) => is + item.product.cost * item.quantity, 0), 0);
      data.push({
        date: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        revenue: Number(revenue.toFixed(3)),
        profit: Number((revenue - cost).toFixed(3)),
      });
    }
    // Limit data points for large ranges
    if (data.length > 60) {
      const step = Math.ceil(data.length / 60);
      return data.filter((_, i) => i % step === 0);
    }
    return data;
  }, [filteredTx, timeRange]);

  // Revenue by category
  const categoryRevenue = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTx.filter(tx => !tx.refunded).forEach(tx => {
      tx.items.forEach(item => {
        const cat = item.product.category;
        map[cat] = (map[cat] || 0) + item.product.price * item.quantity;
      });
    });
    return Object.entries(map).map(([cat, value]) => ({
      name: t(CATEGORY_I18N_KEYS[cat as ProductCategory]) || cat,
      value: Number(value.toFixed(3)),
    }));
  }, [filteredTx]);

  // Top products
  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; sold: number; revenue: number }> = {};
    filteredTx.filter(tx => !tx.refunded).forEach(tx => {
      tx.items.forEach(item => {
        const id = item.product.id;
        if (!map[id]) map[id] = { name: item.product.name, sold: 0, revenue: 0 };
        map[id].sold += item.quantity;
        map[id].revenue += item.product.price * item.quantity;
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [filteredTx]);

  // Summary stats
  const stats = useMemo(() => {
    const activeTx = filteredTx.filter(tx => !tx.refunded);
    const totalRevenue = activeTx.reduce((s, t) => s + t.total, 0);
    const totalCost = activeTx.reduce((s, t) => s + t.items.reduce((is, item) => is + item.product.cost * item.quantity, 0), 0);
    const avgTransaction = activeTx.length > 0 ? totalRevenue / activeTx.length : 0;
    const totalItems = activeTx.reduce((s, t) => s + t.items.reduce((is, item) => is + item.quantity, 0), 0);
    return {
      totalRevenue,
      totalProfit: totalRevenue - totalCost,
      avgTransaction,
      totalTransactions: activeTx.length,
      totalItems,
      refunds: filteredTx.filter(tx => tx.refunded).length,
    };
  }, [filteredTx]);

  const handleExportInventoryPDF = () => {
    const doc = generateInventoryPDF(products, settings);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('reports.inventoryPDFExported'));
  };

  const handleExportSalesPDF = () => {
    const doc = generateSalesReportPDF(filteredTx, settings);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('reports.salesPDFExported'));
  };

  const handleExportCSV = (type: 'products' | 'transactions') => {
    const csv = type === 'products' ? exportProductsCSV(products) : exportTransactionsCSV(filteredTx);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('reports.csvExported', { type }));
  };

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('reports.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('reports.businessInsights')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">{t('reports.last7Days')}</SelectItem>
              <SelectItem value="30d">{t('reports.last30Days')}</SelectItem>
              <SelectItem value="90d">{t('reports.last90Days')}</SelectItem>
              <SelectItem value="all">{t('reports.allTime')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('reports.totalRevenue'), value: formatCurrency(stats.totalRevenue), icon: DollarSign, color: 'text-green-600' },
          { label: t('reports.netProfit'), value: formatCurrency(stats.totalProfit), icon: TrendingUp, color: 'text-blue-600' },
          { label: t('reports.transactions'), value: stats.totalTransactions, icon: ShoppingCart, color: 'text-purple-600' },
          { label: t('reports.avgTransaction'), value: formatCurrency(stats.avgTransaction), icon: BarChart3, color: 'text-amber-600' },
        ].map((s, i) => (
          <div key={i} className="pos-card p-5">
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

      {/* Revenue Chart */}
      <div className="pos-card p-5">
        <h3 className="font-semibold mb-4">{t('reports.revenueProfit')}</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 90%)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(215, 15%, 48%)" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(215, 15%, 48%)" />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid hsl(214, 20%, 90%)', fontSize: '12px' }}
                formatter={(value: number, name: string) => [formatCurrency(value), name === 'revenue' ? t('reports.revenue') : t('reports.profit')]}
              />
              <Line type="monotone" dataKey="revenue" stroke="hsl(220, 60%, 35%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="profit" stroke="hsl(152, 60%, 40%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category Revenue */}
        <div className="pos-card p-5">
          <h3 className="font-semibold mb-4">{t('reports.revenueByCategory')}</h3>
          <div className="h-64">
            {categoryRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryRevenue} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {categoryRevenue.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [formatCurrency(value), t('reports.revenue')]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">{t('reports.noData')}</div>
            )}
          </div>
          <div className="space-y-2 mt-2">
            {categoryRevenue.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-muted-foreground">{c.name}</span>
                <span className="ml-auto font-medium">{formatCurrency(c.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div className="pos-card p-5">
          <h3 className="font-semibold mb-4">{t('reports.topProducts')}</h3>
          <div className="space-y-3">
            {topProducts.length > 0 ? topProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm font-bold text-muted-foreground w-6">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.sold} {t('reports.sold')}</p>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(p.revenue)}</span>
              </div>
            )) : (
              <div className="text-muted-foreground text-sm text-center py-8">{t('reports.noSalesData')}</div>
            )}
          </div>
        </div>
      </div>

      {/* Export Section */}
      <div className="pos-card p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Download size={18} />
          {t('reports.exportReports')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Button variant="outline" className="gap-2 h-auto py-3" onClick={handleExportInventoryPDF}>
            <FileText size={16} />
            <div className="text-left">
              <p className="text-sm font-medium">{t('reports.inventoryPDF')}</p>
              <p className="text-xs text-muted-foreground">{t('reports.currentStockReport')}</p>
            </div>
          </Button>
          <Button variant="outline" className="gap-2 h-auto py-3" onClick={handleExportSalesPDF}>
            <FileText size={16} />
            <div className="text-left">
              <p className="text-sm font-medium">{t('reports.salesPDF')}</p>
              <p className="text-xs text-muted-foreground">{t('reports.transactionHistory')}</p>
            </div>
          </Button>
          <Button variant="outline" className="gap-2 h-auto py-3" onClick={() => handleExportCSV('products')}>
            <Download size={16} />
            <div className="text-left">
              <p className="text-sm font-medium">{t('reports.inventoryCSV')}</p>
              <p className="text-xs text-muted-foreground">{t('reports.spreadsheetFormat')}</p>
            </div>
          </Button>
          <Button variant="outline" className="gap-2 h-auto py-3" onClick={() => handleExportCSV('transactions')}>
            <Download size={16} />
            <div className="text-left">
              <p className="text-sm font-medium">{t('reports.salesCSV')}</p>
              <p className="text-xs text-muted-foreground">{t('reports.spreadsheetFormat')}</p>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}
