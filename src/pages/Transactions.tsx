import { useState, useMemo } from 'react';
import { addAuditLog } from '@/lib/storage';
import { useDataStore } from '@/lib/dataStore';
import { useI18n } from '@/lib/i18nContext';
import { Transaction, CATEGORY_ICONS, getCategoryIcon, MOBILE_PROVIDERS, MOBILE_PROVIDER_I18N_KEYS } from '@/types/pos';
import { generateReceiptHTML } from '@/lib/pdf';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FileText, Clock, RotateCcw, Printer, Search, Calendar, Copy, Edit2, Check } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function Transactions() {
  const { user } = useAuth();
  const { transactions, refundTransaction, saveTransaction, settings } = useDataStore();
  const { t, formatCurrency, isRTL, locale } = useI18n();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [mobileProviderFilter, setMobileProviderFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [refundConfirm, setRefundConfirm] = useState<string | null>(null);
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);
  const [editRefTx, setEditRefTx] = useState<{ id: string; ref: string } | null>(null);

  const today = new Date().toDateString();
  const todayStats = useMemo(() => {
    const todayTx = transactions.filter(tx => new Date(tx.timestamp).toDateString() === today && !tx.refunded);
    return {
      count: todayTx.length,
      total: todayTx.reduce((s, t) => s + t.total, 0),
      cash: todayTx.filter(t => t.paymentMethod === 'cash').reduce((s, t) => s + t.total, 0)
        + todayTx.filter(t => t.paymentMethod === 'split').reduce((s, t) => s + (t.splitCashAmount || 0), 0),
      mobile: todayTx.filter(t => t.paymentMethod === 'mobile').reduce((s, t) => s + t.total, 0)
        + todayTx.filter(t => t.paymentMethod === 'split').reduce((s, t) => s + (t.splitMobileAmount || 0), 0),
    };
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const matchSearch = tx.id.toLowerCase().includes(q) ||
          tx.items.some(i => i.product.name.toLowerCase().includes(q)) ||
          (tx.customerName && tx.customerName.toLowerCase().includes(q)) ||
          (tx.cashierName && tx.cashierName.toLowerCase().includes(q)) ||
          (tx.transactionReference && tx.transactionReference.toLowerCase().includes(q));
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
      // Mobile provider filter
      if (mobileProviderFilter !== 'all' && tx.mobileProvider !== mobileProviderFilter) return false;
      // Status filter
      if (statusFilter === 'refunded' && !tx.refunded) return false;
      if (statusFilter === 'active' && tx.refunded) return false;
      return true;
    });
  }, [transactions, search, dateFrom, dateTo, paymentFilter, mobileProviderFilter, statusFilter]);

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    const loc = locale === 'ar' ? 'ar' : 'en';
    return d.toLocaleDateString(loc, { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  };

  const paymentIcons: Record<string, string> = { cash: '💵', mobile: '📱', split: '💵📱' };

  const handleRefund = (txId: string) => {
    if (user?.role !== 'owner') {
      toast.error(t('auth.ownerOnly'));
      return;
    }
    setRefundConfirm(txId);
  };

  const confirmRefund = () => {
    if (refundConfirm) {
      refundTransaction(refundConfirm);
      addAuditLog('refund', `Refunded transaction #${refundConfirm.slice(-6).toUpperCase()}`, user?.id, user?.displayName);
      toast.success(t('transactions.refundSuccess'));
      setRefundConfirm(null);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t('transactions.copied', { label }));
  };

  const handleEditRef = () => {
    if (editRefTx && detailTx) {
      const updated = { ...detailTx, transactionReference: editRefTx.ref || undefined };
      saveTransaction(updated);
      toast.success(t('transactions.refUpdated'));
      setEditRefTx(null);
      setDetailTx(updated);
    }
  };

  const handlePrintReceipt = (tx: Transaction) => {
    const html = generateReceiptHTML(tx, settings);
    if (window.electronAPI) {
      window.electronAPI.printReceipt(html);
    } else {
      const win = window.open('', '_blank', 'width=350,height=600');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        win.onload = () => win.print();
        // fallback in case onload doesn't fire
        setTimeout(() => { try { win.print(); } catch (_) { /* already printing */ } }, 500);
      } else {
        // Popup blocked — use hidden iframe
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          doc.write(html);
          doc.close();
          setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => document.body.removeChild(iframe), 2000);
          }, 300);
        }
      }
    }
  };

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t('transactions.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('transactions.totalCount', { count: transactions.length })}</p>
      </div>

      {/* Today's Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="pos-card p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">{t('transactions.todayTransactions')}</p>
          <p className="text-lg font-bold">{todayStats.count}</p>
        </div>
        <div className="pos-card p-3 text-center bg-green-50 dark:bg-green-900/20">
          <p className="text-xs text-green-700 dark:text-green-400 mb-1 font-medium">{t('transactions.todayTotal')}</p>
          <p className="text-lg font-bold text-green-700 dark:text-green-400">{formatCurrency(todayStats.total)}</p>
        </div>
        <div className="pos-card p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">💵 {t('pos.cash')}</p>
          <p className="text-lg font-bold">{formatCurrency(todayStats.cash)}</p>
        </div>
        <div className="pos-card p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">📱 {t('pos.mobile')}</p>
          <p className="text-lg font-bold">{formatCurrency(todayStats.mobile)}</p>
        </div>
      </div>

      {/* Filters */}
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
            <SelectItem value="mobile">{t('pos.mobile')}</SelectItem>
            <SelectItem value="split">{t('pos.split')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={mobileProviderFilter} onValueChange={setMobileProviderFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder={t('transactions.allProviders')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('transactions.allProviders')}</SelectItem>
            {MOBILE_PROVIDERS.map(p => (
              <SelectItem key={p} value={p}>{t(MOBILE_PROVIDER_I18N_KEYS[p])}</SelectItem>
            ))}
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

      {/* Transactions List */}
      {filtered.length === 0 ? (
        <div className="pos-card p-12 flex flex-col items-center text-muted-foreground">
          <FileText size={48} className="opacity-30 mb-3" />
          <p>{t('transactions.noTransactionsFound')}</p>
          <p className="text-sm">{t('transactions.completeASale')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(tx => (
            <div key={tx.id} className={`pos-card p-4 cursor-pointer hover:shadow-md transition-shadow ${tx.refunded ? 'opacity-60 border-red-200' : ''}`} onClick={() => setDetailTx(tx)}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-mono font-semibold"># {tx.id.slice(-6).toUpperCase()}</span>
                    <span className="text-lg">{paymentIcons[tx.paymentMethod]}</span>
                    {tx.mobileProvider && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded">{t(MOBILE_PROVIDER_I18N_KEYS[tx.mobileProvider])}</span>
                    )}
                    {tx.transactionReference && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">{tx.transactionReference}</span>
                    )}
                    {tx.refunded && (
                      <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">{t('transactions.refunded')}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <Clock size={12} />
                    {formatDate(tx.timestamp)}
                    {tx.cashierName && <span className="text-xs">· {t('transactions.by', { name: tx.cashierName })}</span>}
                    {tx.customerName && <span className="text-xs">· {t('transactions.for', { name: tx.customerName })}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{formatCurrency(tx.total)}</p>
                  <p className="text-xs text-muted-foreground">{tx.items.length + (tx.printJobs?.length || 0)} {t('transactions.items')}</p>
                </div>
              </div>
              <div className="mt-2 pl-4 border-l-2 border-muted flex gap-2 justify-end">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handlePrintReceipt(tx); }}>
                  <Printer size={14} />
                </Button>
                {!tx.refunded && user?.role === 'owner' && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); handleRefund(tx.id); }}>
                    <RotateCcw size={14} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailTx} onOpenChange={(open) => !open && setDetailTx(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{paymentIcons[detailTx?.paymentMethod || 'cash']}</span> {t('transactions.transactionDetails')}
            </DialogTitle>
          </DialogHeader>
          {detailTx && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-muted-foreground">{t('transactions.reference')}</p>
                  <p className="text-sm font-mono font-semibold">#{detailTx.id.slice(-6).toUpperCase()}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopy(detailTx.id.slice(-6).toUpperCase(), 'ID')}>
                  <Copy size={14} />
                </Button>
              </div>
              <div className="border-t pt-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t('transactions.date')}</span><span>{formatDate(detailTx.timestamp)}</span></div>
                {detailTx.cashierName && <div className="flex justify-between"><span className="text-muted-foreground">{t('transactions.cashier')}</span><span>{detailTx.cashierName}</span></div>}
                {detailTx.customerName && <div className="flex justify-between"><span className="text-muted-foreground">{t('transactions.customer')}</span><span>{detailTx.customerName}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">{t('pos.paymentMethod')}</span><span className="capitalize">{detailTx.paymentMethod}</span></div>
                {detailTx.mobileProvider && <div className="flex justify-between"><span className="text-muted-foreground">{t('pos.mobileProvider')}</span><span>{t(MOBILE_PROVIDER_I18N_KEYS[detailTx.mobileProvider])}</span></div>}
                {detailTx.paymentMethod === 'cash' && detailTx.cashTendered != null && (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('pos.cashTendered')}</span><span>{formatCurrency(detailTx.cashTendered)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('pos.changeDue')}</span><span>{formatCurrency(detailTx.changeDue || 0)}</span></div>
                  </>
                )}
                {detailTx.paymentMethod === 'split' && (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('pos.splitCashAmount')}</span><span>{formatCurrency(detailTx.splitCashAmount || 0)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t('pos.splitMobileAmount')}</span><span>{formatCurrency(detailTx.splitMobileAmount || 0)}</span></div>
                  </>
                )}
              </div>
              {detailTx.paymentMethod === 'mobile' && (
                <div className="border-t pt-3">
                  {editRefTx?.id === detailTx.id ? (
                    <div className="flex gap-2">
                      <Input type="text" value={editRefTx.ref} onChange={e => setEditRefTx({ id: detailTx.id, ref: e.target.value })} placeholder={t('pos.authCodePlaceholder')} className="h-8 text-sm" />
                      <Button size="sm" className="gap-1" onClick={handleEditRef}>
                        <Check size={14} /> {t('common.save')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditRefTx(null)}>{t('common.cancel')}</Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">{t('pos.transactionRef')}</p>
                        <p className="text-sm font-mono">{detailTx.transactionReference || t('transactions.notProvided')}</p>
                      </div>
                      <div className="flex gap-1">
                        {detailTx.transactionReference && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopy(detailTx.transactionReference || '', 'Reference')}>
                            <Copy size={14} />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditRefTx({ id: detailTx.id, ref: detailTx.transactionReference || '' })}>
                          <Edit2 size={14} />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="border-t pt-3 space-y-1">
                {detailTx.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{getCategoryIcon(item.product.category, settings.customCategories)} {item.product.name} ×{item.quantity}</span>
                    <span className="font-medium">{formatCurrency(item.product.price * item.quantity)}</span>
                  </div>
                ))}
                {detailTx.printJobs?.map((job, i) => (
                  <div key={`pj-${i}`} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">🖨️ {job.printType === 'bw' ? t('pos.printBW') : t('pos.printColor')} ×{job.copies}</span>
                    <span className="font-medium">{formatCurrency(job.total)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t('pos.subtotal')}</span><span>{formatCurrency(detailTx.subtotal)}</span></div>
                {detailTx.discount > 0 && <div className="flex justify-between text-green-600"><span>{t('transactions.discount')}</span><span>-{formatCurrency(detailTx.discount)}</span></div>}
                <div className="flex justify-between font-bold text-base border-t pt-1"><span>{t('pos.total')}</span><span>{formatCurrency(detailTx.total)}</span></div>
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="secondary" onClick={() => setDetailTx(null)}>{t('common.close')}</Button>
            <Button className="gap-1" onClick={() => detailTx && handlePrintReceipt(detailTx)}>
              <Printer size={14} /> {t('transactions.receipt')}
            </Button>
            {detailTx && !detailTx.refunded && user?.role === 'owner' && (
              <Button variant="destructive" className="gap-1" onClick={() => { setDetailTx(null); handleRefund(detailTx.id); }}>
                <RotateCcw size={14} /> {t('transactions.refund')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Confirmation */}
      <ConfirmDialog
        open={refundConfirm !== null}
        onOpenChange={(open) => !open && setRefundConfirm(null)}
        title={t('confirm.refundTransaction')}
        description={t('confirm.refundTransactionDesc')}
        confirmLabel={t('transactions.refund')}
        onConfirm={confirmRefund}
      />
    </div>
  );
}
