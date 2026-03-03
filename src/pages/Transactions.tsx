import { useState, useMemo } from 'react';
import { addAuditLog } from '@/lib/storage';
import { useDataStore } from '@/lib/dataStore';
import { useI18n } from '@/lib/i18nContext';
import { Transaction, CATEGORY_ICONS } from '@/types/pos';
import { generateReceiptHTML } from '@/lib/pdf';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Clock, RotateCcw, Printer, Search, Calendar, Filter } from 'lucide-react';
import { toast } from 'sonner';

export default function Transactions() {
  const { user } = useAuth();
  const { transactions, refundTransaction, settings } = useDataStore();
  const { t, formatCurrency, isRTL } = useI18n();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const matchSearch = tx.id.toLowerCase().includes(q) ||
          tx.items.some(i => i.product.name.toLowerCase().includes(q)) ||
          (tx.customerName && tx.customerName.toLowerCase().includes(q)) ||
          (tx.cashierName && tx.cashierName.toLowerCase().includes(q));
        if (!matchSearch) return false;
      }
      // Date range filter
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        if (new Date(tx.timestamp) < fromDate) return false;
      }
      if (dateTo) {
        const toDate = new Date(dateTo + 'T23:59:59');
        if (new Date(tx.timestamp) > toDate) return false;
      }
      // Payment method filter
      if (paymentFilter !== 'all' && tx.paymentMethod !== paymentFilter) return false;
      // Status filter
      if (statusFilter === 'refunded' && !tx.refunded) return false;
      if (statusFilter === 'active' && tx.refunded) return false;
      return true;
    });
  }, [transactions, search, dateFrom, dateTo, paymentFilter, statusFilter]);

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  };

  const paymentIcons: Record<string, string> = { cash: '💵', card: '💳', mobile: '📱' };

  const handleRefund = (txId: string) => {
    refundTransaction(txId);
    addAuditLog('refund', `Refunded transaction #${txId.slice(-6).toUpperCase()}`, user?.id, user?.displayName);
    toast.success(t('transactions.refundSuccess'));
  };

  const handlePrintReceipt = (tx: Transaction) => {
    const html = generateReceiptHTML(tx, settings);
    if (window.electronAPI) {
      window.electronAPI.printReceipt(html);
    } else {
      const win = window.open('', '_blank');
      win?.document.write(html);
      win?.print();
    }
  };

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      <div>
        <h1 className="text-2xl font-bold">{t('transactions.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('transactions.totalCount', { count: transactions.length })}</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
          <Input placeholder={t('transactions.searchTransactions')} value={search} onChange={e => setSearch(e.target.value)} className={isRTL ? 'pr-9' : 'pl-9'} />
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-muted-foreground" />
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[140px] h-9 text-xs" />
          <span className="text-xs text-muted-foreground">{t('transactions.to')}</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[140px] h-9 text-xs" />
        </div>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('transactions.allMethods')}</SelectItem>
            <SelectItem value="cash">{t('pos.cash')}</SelectItem>
            <SelectItem value="card">{t('pos.card')}</SelectItem>
            <SelectItem value="mobile">{t('pos.mobile')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('transactions.allStatus')}</SelectItem>
            <SelectItem value="active">{t('transactions.active')}</SelectItem>
            <SelectItem value="refunded">{t('transactions.refunded')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="pos-card p-12 flex flex-col items-center text-muted-foreground">
          <FileText size={48} className="opacity-30 mb-3" />
          <p>{t('transactions.noTransactionsFound')}</p>
          <p className="text-sm">{t('transactions.completeASale')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(tx => (
            <div key={tx.id} className={`pos-card p-4 ${tx.refunded ? 'opacity-60 border-red-200' : ''}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-muted-foreground">#{tx.id.slice(-6).toUpperCase()}</span>
                    <span className="text-lg">{paymentIcons[tx.paymentMethod]}</span>
                    {tx.refunded && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{t('transactions.refunded')}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                    <Clock size={12} />
                    {formatDate(tx.timestamp)}
                    {tx.cashierName && <span>· {t('transactions.by', { name: tx.cashierName })}</span>}
                    {tx.customerName && <span>· {t('transactions.for', { name: tx.customerName })}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{formatCurrency(tx.total)}</p>
                  <p className="text-xs text-muted-foreground">{tx.items.length} {tx.items.length > 1 ? t('transactions.items') : t('transactions.item')}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t space-y-1">
                {tx.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {CATEGORY_ICONS[item.product.category]} {item.product.name} × {item.quantity}
                    </span>
                    <span className="font-medium">{(item.product.price * item.quantity).toFixed(3)}</span>
                  </div>
                ))}
                {tx.printJobs && tx.printJobs.map((job, i) => (
                  <div key={`pj-${i}`} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      🖨️ {job.printType === 'bw' ? 'B&W' : 'Color'} Print ({job.pageCount}pg × {job.copies})
                    </span>
                    <span className="font-medium">{job.total.toFixed(3)}</span>
                  </div>
                ))}
                {tx.discount > 0 && (
                  <div className="flex items-center justify-between text-sm text-green-600">
                    <span>{t('transactions.discount')}</span>
                    <span>-{tx.discount.toFixed(3)}</span>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-2 border-t flex gap-2 justify-end">
                <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => handlePrintReceipt(tx)}>
                  <Printer size={12} /> {t('transactions.receipt')}
                </Button>
                {!tx.refunded && user?.role === 'owner' && (
                  <Button variant="outline" size="sm" className="gap-1 h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleRefund(tx.id)}>
                    <RotateCcw size={12} /> {t('transactions.refund')}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
