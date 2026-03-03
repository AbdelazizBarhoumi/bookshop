import { useState, useMemo } from 'react';
import { generateId, addAuditLog } from '@/lib/storage';
import { Product, CartItem, Transaction, PrintJob, Customer, CATEGORY_LABELS, CATEGORY_ICONS, CATEGORY_I18N_KEYS, type ProductCategory } from '@/types/pos';
import { generateReceiptHTML } from '@/lib/pdf';
import { useAuth } from '@/lib/auth';
import { useDataStore } from '@/lib/dataStore';
import { useI18n } from '@/lib/i18nContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, Smartphone, Receipt, Printer, UserCheck, Star, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function PointOfSale() {
  const { user } = useAuth();
  const store = useDataStore();
  const { t, formatCurrency, isRTL } = useI18n();
  const products = store.products;
  const customers = store.customers;
  const settings = store.settings;
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile'>('cash');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const WALKIN_VALUE = 'none';

  const handleCustomerChange = (v: string) => {
    setSelectedCustomerId(v === WALKIN_VALUE ? '' : v);
  };

  const customerSelectValue = selectedCustomerId === '' ? WALKIN_VALUE : selectedCustomerId;
  const [printJobOpen, setPrintJobOpen] = useState(false);
  type PrintJobForm = {
    printType: 'bw' | 'color';
    pageCount: number;
    copies: number;
    paperSize: 'A4' | 'A3' | 'Letter';
    binding: 'none' | 'spiral' | 'staple';
  };
  const [printJobForm, setPrintJobForm] = useState<PrintJobForm>({
    printType: 'bw',
    pageCount: 1,
    copies: 1,
    paperSize: 'A4',
    binding: 'none',
  });
  const [discountPercent, setDiscountPercent] = useState(0);
  const [cashTendered, setCashTendered] = useState(0);
  const [loyaltyRedeem, setLoyaltyRedeem] = useState(0);
  const [dailyCloseOpen, setDailyCloseOpen] = useState(false);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [products, search, categoryFilter]);

  const addToCart = (product: Product) => {
    if (product.quantity <= 0 && product.category !== 'services') {
      toast.error(t('pos.outOfStock'));
      return;
    }
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.quantity && product.category !== 'services') {
          toast.error(t('pos.notEnoughStock'));
          return prev;
        }
        return prev.map(c => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { product, quantity: 1, discount: 0 }];
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.product.id !== productId) return c;
      const newQty = c.quantity + delta;
      if (newQty <= 0) return c;
      if (newQty > c.product.quantity && c.product.category !== 'services') {
        toast.error(t('pos.notEnoughStock'));
        return c;
      }
      return { ...c, quantity: newQty };
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(c => c.product.id !== productId));
  };

  // Print job calculator
  const printJobTotal = useMemo(() => {
    const pricePerPage = printJobForm.printType === 'bw' ? settings.bwPricePerPage : settings.colorPricePerPage;
    const bindingPrice = printJobForm.binding === 'spiral' ? settings.spiralBindingPrice :
      printJobForm.binding === 'staple' ? settings.stapleBindingPrice : 0;
    return (pricePerPage * printJobForm.pageCount * printJobForm.copies) + bindingPrice;
  }, [printJobForm, settings]);

  const addPrintJob = () => {
    const pricePerPage = printJobForm.printType === 'bw' ? settings.bwPricePerPage : settings.colorPricePerPage;
    const bindingPrice = printJobForm.binding === 'spiral' ? settings.spiralBindingPrice :
      printJobForm.binding === 'staple' ? settings.stapleBindingPrice : 0;
    const job: PrintJob = {
      id: generateId(),
      ...printJobForm,
      pricePerPage,
      bindingPrice,
      total: printJobTotal,
    };
    setPrintJobs(prev => [...prev, job]);
    setPrintJobOpen(false);
    toast.success(t('pos.printJobAdded', { amount: formatCurrency(printJobTotal) }));
  };

  const removePrintJob = (id: string) => {
    setPrintJobs(prev => prev.filter(j => j.id !== id));
  };

  const cartSubtotal = cart.reduce((s, c) => s + c.product.price * c.quantity * (1 - c.discount / 100), 0);
  const printJobsSubtotal = printJobs.reduce((s, j) => s + j.total, 0);
  const subtotal = cartSubtotal + printJobsSubtotal;
  const discountAmount = subtotal * (discountPercent / 100);
  const loyaltyDiscount = loyaltyRedeem * 0.01; // 1 point = 0.010 SDG
  const taxableAmount = subtotal - discountAmount - loyaltyDiscount;
  const tax = taxableAmount * settings.taxRate;
  const total = Math.max(0, taxableAmount + tax);
  const changeDue = paymentMethod === 'cash' ? Math.max(0, cashTendered - total) : 0;

  // Daily close summary
  const dailyStats = useMemo(() => {
    const allTx = store.transactions;
    const todayTx = allTx.filter(tx => {
      const txDate = new Date(tx.timestamp).toDateString();
      return txDate === new Date().toDateString() && !tx.refunded;
    });
    const totalRevenue = todayTx.reduce((s, t) => s + t.total, 0);
    const totalCash = todayTx.filter(t => t.paymentMethod === 'cash').reduce((s, t) => s + t.total, 0);
    const totalCard = todayTx.filter(t => t.paymentMethod === 'card').reduce((s, t) => s + t.total, 0);
    const totalMobile = todayTx.filter(t => t.paymentMethod === 'mobile').reduce((s, t) => s + t.total, 0);
    const refunds = allTx.filter(tx => tx.refunded && new Date(tx.refundedAt || '').toDateString() === new Date().toDateString());
    return { count: todayTx.length, totalRevenue, totalCash, totalCard, totalMobile, refundCount: refunds.length };
  }, [store.transactions]);

  const handleCheckout = () => {
    if (cart.length === 0 && printJobs.length === 0) { toast.error(t('pos.cartEmpty')); return; }
    if (paymentMethod === 'cash' && cashTendered > 0 && cashTendered < total) {
      toast.error(t('pos.insufficientCash'));
      return;
    }

    // Deduct stock - update each product through the store
    cart.forEach(cartItem => {
      const p = products.find(pr => pr.id === cartItem.product.id);
      if (p && p.category !== 'services') {
        store.updateProduct({ ...p, quantity: p.quantity - cartItem.quantity, updatedAt: new Date().toISOString() });
      }
    });

    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

    // Save transaction
    const tx: Transaction = {
      id: generateId(),
      items: cart,
      printJobs: printJobs.length > 0 ? printJobs : undefined,
      subtotal,
      tax,
      discount: discountAmount + loyaltyDiscount,
      total,
      paymentMethod,
      timestamp: new Date().toISOString(),
      cashierId: user?.id,
      cashierName: user?.displayName,
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      notes: loyaltyRedeem > 0 ? `Loyalty points redeemed: ${loyaltyRedeem}` : undefined,
    };
    store.saveTransaction(tx);

    // Update customer stats and deduct loyalty points
    if (selectedCustomer) {
      const loyaltyPointsEarned = Math.floor(total);
      store.updateCustomer({
        ...selectedCustomer,
        totalSpent: selectedCustomer.totalSpent + total,
        purchaseCount: selectedCustomer.purchaseCount + 1,
        loyaltyPoints: selectedCustomer.loyaltyPoints - loyaltyRedeem + loyaltyPointsEarned,
        updatedAt: new Date().toISOString(),
      });
    }

    // Audit log
    addAuditLog('sale', `Sale #${tx.id.slice(-6).toUpperCase()}: ${formatCurrency(total)} (${paymentMethod})`, user?.id, user?.displayName);

    // Print receipt if Electron is available
    if (window.electronAPI) {
      const receiptHTML = generateReceiptHTML(tx, settings);
      window.electronAPI.printReceipt(receiptHTML);
    }

    // Show change if cash
    if (paymentMethod === 'cash' && cashTendered > 0) {
      toast.success(t('pos.saleCompletedChange', { amount: formatCurrency(changeDue) }));
    } else {
      toast.success(t('pos.saleCompletedTotal', { amount: formatCurrency(total) }));
    }

    setCart([]);
    setPrintJobs([]);
    setDiscountPercent(0);
    setSelectedCustomerId('');
    setCashTendered(0);
    setLoyaltyRedeem(0);
  };

  return (
    <div className="flex h-screen animate-slide-in">
      {/* Product Grid */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">{t('pos.title')}</h1>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setDailyCloseOpen(true)}>
              <Clock size={16} /> {t('pos.dailyClose')}
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setPrintJobOpen(true)}>
              <Printer size={16} /> {t('pos.addPrintJob')}
            </Button>
          </div>
        </div>
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
            <Input placeholder={t('pos.search')} value={search} onChange={e => setSearch(e.target.value)} className={isRTL ? 'pr-9' : 'pl-9'} />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t('pos.all')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pos.all')}</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{t(CATEGORY_I18N_KEYS[k as ProductCategory])}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.map(p => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="pos-card-hover p-4 text-left group"
              >
                <div className="text-2xl mb-2">{CATEGORY_ICONS[p.category]}</div>
                <p className="font-medium text-sm truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t(CATEGORY_I18N_KEYS[p.category as ProductCategory])}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-semibold text-primary">{formatCurrency(p.price)}</span>
                  <span className={`text-xs ${p.quantity <= p.lowStockThreshold && p.category !== 'services' ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {p.category === 'services' ? '∞' : `${p.quantity} ${t('pos.left')}`}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-96 bg-card border-l flex flex-col shrink-0">
        <div className="p-4 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <ShoppingCart size={18} />
            {t('pos.currentSale')}
            {cart.length > 0 && (
              <span className={`${isRTL ? 'mr-auto' : 'ml-auto'} text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full`}>
                {cart.reduce((s, c) => s + c.quantity, 0)}
              </span>
            )}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 && printJobs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Receipt size={40} className="opacity-30 mb-3" />
              <p className="text-sm">{t('pos.noItemsInCart')}</p>
              <p className="text-xs">{t('pos.tapToAdd')}</p>
            </div>
          ) : (
            <>
              {cart.map(item => (
                <div key={item.product.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(item.product.price)} {t('pos.each')}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateCartQty(item.product.id, -1)}>
                      <Minus size={12} />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateCartQty(item.product.id, 1)}>
                      <Plus size={12} />
                    </Button>
                  </div>
                  <p className="text-sm font-semibold w-20 text-right">{formatCurrency(item.product.price * item.quantity)}</p>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.product.id)}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              ))}
              {/* Print Jobs in cart */}
              {printJobs.map(job => (
                <div key={job.id} className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <Printer size={16} className="text-blue-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{job.printType === 'bw' ? t('pos.printBW') : t('pos.printColor')} {t('pos.printLabel')}</p>
                    <p className="text-xs text-muted-foreground">{job.pageCount}pg × {job.copies} copies{job.binding !== 'none' ? ` + ${job.binding}` : ''}</p>
                  </div>
                  <p className="text-sm font-semibold">{formatCurrency(job.total)}</p>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removePrintJob(job.id)}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Totals & Checkout */}
        <div className="p-4 border-t space-y-3">
          {/* Customer selector */}
          <div className="flex items-center gap-2">
            <UserCheck size={14} className="text-muted-foreground shrink-0" />
            <Select value={customerSelectValue} onValueChange={handleCustomerChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={t('pos.walkinCustomer')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={WALKIN_VALUE}>{t('pos.walkinCustomer')}</SelectItem>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Discount */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t('pos.discountPercent')}</span>
            <Input
              type="number"
              min="0"
              max="100"
              value={discountPercent}
              onChange={e => setDiscountPercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
              className="h-8 w-20 text-xs"
            />
          </div>

          {/* Loyalty Points Redemption */}
          {selectedCustomerId && (() => {
            const c = customers.find(cu => cu.id === selectedCustomerId);
            return c && c.loyaltyPoints > 0 ? (
              <div className="flex items-center gap-2">
                <Star size={14} className="text-yellow-500 shrink-0" />
                <span className="text-xs text-muted-foreground">{c.loyaltyPoints} {t('pos.points')}</span>
                <Input
                  type="number"
                  min="0"
                  max={c.loyaltyPoints}
                  value={loyaltyRedeem || ''}
                  onChange={e => setLoyaltyRedeem(Math.min(c.loyaltyPoints, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="h-8 w-20 text-xs"
                  placeholder={t('pos.redeem')}
                />
                {loyaltyRedeem > 0 && <span className="text-xs text-green-600">-{loyaltyDiscount.toFixed(3)}</span>}
              </div>
            ) : null;
          })()}

          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{t('pos.subtotal')}</span><span>{formatCurrency(subtotal)}</span></div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600"><span>{t('pos.discountLabel', { percent: discountPercent })}</span><span>-{formatCurrency(discountAmount)}</span></div>
            )}
            {loyaltyDiscount > 0 && (
              <div className="flex justify-between text-green-600"><span>{t('pos.loyaltyDiscount', { points: loyaltyRedeem })}</span><span>-{formatCurrency(loyaltyDiscount)}</span></div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">{t('pos.tax')} ({(settings.taxRate * 100).toFixed(0)}%)</span><span>{formatCurrency(tax)}</span></div>
            <div className="flex justify-between font-bold text-lg pt-1 border-t"><span>{t('pos.total')}</span><span>{formatCurrency(total)}</span></div>
          </div>

          {/* Cash Tendered / Change */}
          {paymentMethod === 'cash' && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t('pos.cashTendered')}</span>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={cashTendered || ''}
                  onChange={e => setCashTendered(parseFloat(e.target.value) || 0)}
                  className="h-8 flex-1 text-xs"
                  placeholder={t('pos.amountGiven')}
                />
              </div>
              {cashTendered > 0 && (
                <div className={`flex justify-between text-sm font-semibold ${changeDue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <span>{t('pos.changeDue')}</span>
                  <span>{formatCurrency(changeDue)}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {([
              { v: 'cash' as const, icon: Banknote, label: t('pos.cash') },
              { v: 'card' as const, icon: CreditCard, label: t('pos.card') },
              { v: 'mobile' as const, icon: Smartphone, label: t('pos.mobile') },
            ]).map(({ v, icon: Icon, label }) => (
              <button
                key={v}
                onClick={() => setPaymentMethod(v)}
                className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-colors ${
                  paymentMethod === v ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          <Button className="w-full h-12 text-base font-semibold" onClick={handleCheckout} disabled={cart.length === 0 && printJobs.length === 0}>
            {t('pos.completeSale')}
          </Button>
        </div>
      </div>

      {/* Print Job Dialog */}
      <Dialog open={printJobOpen} onOpenChange={setPrintJobOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Printer size={18} /> {t('pos.addPrintJob')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('pos.printType')}</Label>
                <Select value={printJobForm.printType} onValueChange={v => setPrintJobForm(p => ({ ...p, printType: v as PrintJobForm['printType'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bw">{t('pos.blackAndWhite', { price: settings.bwPricePerPage.toFixed(3) })}</SelectItem>
                    <SelectItem value="color">{t('pos.colorPrint', { price: settings.colorPricePerPage.toFixed(3) })}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('pos.paperSize')}</Label>
                <Select value={printJobForm.paperSize} onValueChange={v => setPrintJobForm(p => ({ ...p, paperSize: v as PrintJobForm['paperSize'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4</SelectItem>
                    <SelectItem value="A3">A3</SelectItem>
                    <SelectItem value="Letter">Letter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('pos.pages')}</Label>
                <Input type="number" min="1" value={printJobForm.pageCount} onChange={e => setPrintJobForm(p => ({ ...p, pageCount: Math.max(1, parseInt(e.target.value) || 1) }))} />
              </div>
              <div>
                <Label>{t('pos.copies')}</Label>
                <Input type="number" min="1" value={printJobForm.copies} onChange={e => setPrintJobForm(p => ({ ...p, copies: Math.max(1, parseInt(e.target.value) || 1) }))} />
              </div>
              <div className="col-span-2">
                <Label>{t('pos.binding')}</Label>
                <Select value={printJobForm.binding} onValueChange={v => setPrintJobForm(p => ({ ...p, binding: v as PrintJobForm['binding'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('pos.noBinding')}</SelectItem>
                    <SelectItem value="spiral">{t('pos.spiralPrice', { price: formatCurrency(settings.spiralBindingPrice) })}</SelectItem>
                    <SelectItem value="staple">{t('pos.staplePrice', { price: formatCurrency(settings.stapleBindingPrice) })}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted flex justify-between items-center">
              <span className="font-medium">{t('pos.estimatedTotal')}</span>
              <span className="text-lg font-bold">{formatCurrency(printJobTotal)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPrintJobOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={addPrintJob}>{t('pos.addToCart')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Daily Close Dialog */}
      <Dialog open={dailyCloseOpen} onOpenChange={setDailyCloseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Clock size={18} /> {t('pos.endOfDaySummary')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <div className="space-y-2">
              <div className="flex justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm">{t('pos.totalTransactions')}</span>
                <span className="font-bold">{dailyStats.count}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-green-50">
                <span className="text-sm font-medium">{t('pos.totalRevenue')}</span>
                <span className="font-bold text-green-700">{formatCurrency(dailyStats.totalRevenue)}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-sm text-muted-foreground">{t('pos.cash')}</span>
                <span className="font-medium">{formatCurrency(dailyStats.totalCash)}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-sm text-muted-foreground">{t('pos.card')}</span>
                <span className="font-medium">{formatCurrency(dailyStats.totalCard)}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-sm text-muted-foreground">{t('pos.mobile')}</span>
                <span className="font-medium">{formatCurrency(dailyStats.totalMobile)}</span>
              </div>
              {dailyStats.refundCount > 0 && (
                <div className="flex justify-between p-3 rounded-lg bg-red-50">
                  <span className="text-sm text-red-600">{t('pos.refunds')}</span>
                  <span className="font-medium text-red-600">{dailyStats.refundCount}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t('pos.cashierLabel')}: {user?.displayName}</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setDailyCloseOpen(false)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
