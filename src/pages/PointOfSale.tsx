/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { generateId, addAuditLog } from '@/lib/storage';
import { Product, CartItem, Transaction, PrintJob, Customer, CATEGORY_LABELS, CATEGORY_ICONS, CATEGORY_I18N_KEYS, type ProductCategory, type BuiltInCategory, getAllCategories, getCategoryIcon, getCategoryLabel, MOBILE_PROVIDERS, MOBILE_PROVIDER_I18N_KEYS, type MobileProvider } from '@/types/pos';
import { generateReceiptHTML } from '@/lib/pdf';
import { useAuth } from '@/lib/auth';
import { useDataStore } from '@/lib/dataStore';
import { useI18n } from '@/lib/i18nContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, Plus, Minus, Trash2, ShoppingCart, Banknote, Smartphone, Receipt, Printer, UserCheck, Star, Clock, X, Eye, Split, PauseCircle, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';

interface HeldOrder {
  id: string;
  label: string;
  cart: CartItem[];
  printJobs: PrintJob[];
  discountPercent: number;
  selectedCustomerId: string;
  paymentMethod: 'cash' | 'mobile' | 'split';
  mobileProvider: MobileProvider | '';
  cashTendered: number;
  loyaltyRedeem: number;
  splitCashAmount: number;
  splitMobileAmount: number;
  transactionReference: string;
  heldAt: string;
}

const HELD_ORDERS_KEY = 'pos_held_orders';
const HELD_ORDER_COUNTER_KEY = 'pos_held_order_counter';

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
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile' | 'split'>('cash');
  const [mobileProvider, setMobileProvider] = useState<MobileProvider | ''>('');
  const [splitCashAmount, setSplitCashAmount] = useState(0);
  const [splitMobileAmount, setSplitMobileAmount] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const WALKIN_VALUE = 'none';

  // Held orders – persisted to localStorage so they survive page refreshes
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>(() => {
    try {
      const saved = localStorage.getItem(HELD_ORDERS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Monotonically increasing counter so order labels are always unique
  const nextOrderNumber = () => {
    const current = parseInt(localStorage.getItem(HELD_ORDER_COUNTER_KEY) || '0', 10);
    const next = current + 1;
    localStorage.setItem(HELD_ORDER_COUNTER_KEY, String(next));
    return next;
  };

  // Confirmation dialog state for resuming with non-empty cart
  const [resumeConfirm, setResumeConfirm] = useState<HeldOrder | null>(null);

  // Keep localStorage in sync whenever heldOrders changes
  useEffect(() => {
    localStorage.setItem(HELD_ORDERS_KEY, JSON.stringify(heldOrders));
  }, [heldOrders]);

  const handleCustomerChange = (v: string) => {
    setSelectedCustomerId(v === WALKIN_VALUE ? '' : v);
    setLoyaltyRedeem(0);
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
  const [transactionReference, setTransactionReference] = useState('');
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);

  const buildHeldFromCurrent = (label: string): HeldOrder => ({
    id: generateId(),
    label,
    cart,
    printJobs,
    discountPercent,
    selectedCustomerId,
    paymentMethod,
    mobileProvider,
    cashTendered,
    loyaltyRedeem,
    splitCashAmount,
    splitMobileAmount,
    transactionReference,
    heldAt: new Date().toISOString(),
  });

  const clearCurrentCart = () => {
    setCart([]);
    setPrintJobs([]);
    setDiscountPercent(0);
    setCashTendered(0);
    setLoyaltyRedeem(0);
    setSplitCashAmount(0);
    setSplitMobileAmount(0);
    setMobileProvider('');
    setSelectedCustomerId('');
    setTransactionReference('');
  };

  const holdCurrentOrder = () => {
    if (cart.length === 0 && printJobs.length === 0) {
      toast.error(t('pos.cartEmpty'));
      return;
    }
    const customer = customers.find(c => c.id === selectedCustomerId);
    const label = customer ? customer.name : t('pos.orderLabel', { n: nextOrderNumber() });
    const held = buildHeldFromCurrent(label);
    setHeldOrders(prev => [...prev, held]);
    clearCurrentCart();
    toast.success(t('pos.orderHeld', { label }));
  };

  const doResumeHeldOrder = (held: HeldOrder, autoHoldCurrent: boolean) => {
    if (autoHoldCurrent && (cart.length > 0 || printJobs.length > 0)) {
      const customer = customers.find(c => c.id === selectedCustomerId);
      const label = customer ? customer.name : t('pos.orderLabel', { n: nextOrderNumber() });
      const autoHeld = buildHeldFromCurrent(label);
      setHeldOrders(prev => [...prev.filter(o => o.id !== held.id), autoHeld]);
    } else {
      setHeldOrders(prev => prev.filter(o => o.id !== held.id));
    }
    setCart(held.cart);
    setPrintJobs(held.printJobs);
    setDiscountPercent(held.discountPercent);
    setSelectedCustomerId(held.selectedCustomerId);
    setPaymentMethod(held.paymentMethod);
    setMobileProvider(held.mobileProvider);
    setCashTendered(held.cashTendered);
    setLoyaltyRedeem(held.loyaltyRedeem);
    setSplitCashAmount(held.splitCashAmount);
    setSplitMobileAmount(held.splitMobileAmount);
    setTransactionReference(held.transactionReference);
    toast.success(t('pos.orderResumed', { label: held.label }));
  };

  const resumeHeldOrder = (held: HeldOrder) => {
    if (cart.length > 0 || printJobs.length > 0) {
      setResumeConfirm(held);
    } else {
      doResumeHeldOrder(held, false);
    }
  };

  const deleteHeldOrder = (id: string) => {
    setHeldOrders(prev => prev.filter(o => o.id !== id));
    toast.info(t('pos.heldDiscarded'));
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()));
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

  const setCartQtyDirect = (productId: string, qty: number) => {
    setCart(prev => prev.map(c => {
      if (c.product.id !== productId) return c;
      if (qty <= 0) return c;
      if (qty > c.product.quantity && c.product.category !== 'services') {
        toast.error(t('pos.notEnoughStock'));
        return { ...c, quantity: c.product.quantity };
      }
      return { ...c, quantity: qty };
    }));
  };

  const clearCart = () => {
    setCart([]);
    setPrintJobs([]);
    setDiscountPercent(0);
    setCashTendered(0);
    setLoyaltyRedeem(0);
    setSplitCashAmount(0);
    setSplitMobileAmount(0);
    setMobileProvider('');
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
  const total = Math.max(0, subtotal - discountAmount - loyaltyDiscount);
  const changeDue = paymentMethod === 'cash' ? Math.max(0, cashTendered - total) : 0;

  // Daily close summary
  const dailyStats = useMemo(() => {
    const allTx = store.transactions;
    const todayTx = allTx.filter(tx => {
      const txDate = new Date(tx.timestamp).toDateString();
      return txDate === new Date().toDateString() && !tx.refunded;
    });
    const totalRevenue = todayTx.reduce((s, t) => s + t.total, 0);
    const totalCash = todayTx.filter(t => t.paymentMethod === 'cash').reduce((s, t) => s + t.total, 0)
      + todayTx.filter(t => t.paymentMethod === 'split').reduce((s, t) => s + (t.splitCashAmount || 0), 0);
    const totalMobile = todayTx.filter(t => t.paymentMethod === 'mobile').reduce((s, t) => s + t.total, 0)
      + todayTx.filter(t => t.paymentMethod === 'split').reduce((s, t) => s + (t.splitMobileAmount || 0), 0);
    const refunds = allTx.filter(tx => tx.refunded && new Date(tx.refundedAt || '').toDateString() === new Date().toDateString());
    return { count: todayTx.length, totalRevenue, totalCash, totalMobile, refundCount: refunds.length };
  }, [store.transactions]);

  const handleCheckout = () => {
    if (cart.length === 0 && printJobs.length === 0) { toast.error(t('pos.cartEmpty')); return; }

    // Validate discount
    if (discountPercent < 0 || discountPercent > 100 || isNaN(discountPercent)) {
      toast.error(t('pos.invalidDiscount'));
      return;
    }

    // Validate loyalty points
    if (selectedCustomerId) {
      const cust = customers.find(cu => cu.id === selectedCustomerId);
      if (cust && loyaltyRedeem > cust.loyaltyPoints) {
        toast.error(t('pos.loyaltyExceedsPoints'));
        return;
      }
    }

    // Validate cash tendered — amount is required for cash payments
    if (paymentMethod === 'cash') {
      if (cashTendered <= 0) {
        toast.error(t('pos.cashRequired'));
        return;
      }
      if (cashTendered < total) {
        toast.error(t('pos.insufficientCash'));
        return;
      }
    }

    // Validate split payment
    if (paymentMethod === 'split') {
      if (splitCashAmount <= 0 || splitMobileAmount <= 0) {
        toast.error(t('pos.splitBothRequired'));
        return;
      }
      const splitSum = Math.round(splitCashAmount + splitMobileAmount);
      const roundedTotal = Math.round(total);
      if (splitSum < roundedTotal) {
        toast.error(t('pos.splitMustEqualTotal'));
        return;
      }
    }

    // Validate stock at checkout time — remove or adjust items that are no longer available
    let stockIssue = false;
    const verifiedCart = cart.filter(cartItem => {
      if (cartItem.product.category === 'services') return true;
      const current = products.find(pr => pr.id === cartItem.product.id);
      if (!current || current.quantity <= 0) {
        toast.error(t('pos.stockChanged', { name: cartItem.product.name }));
        stockIssue = true;
        return false;
      }
      if (cartItem.quantity > current.quantity) {
        cartItem.quantity = current.quantity;
        stockIssue = true;
      }
      return true;
    });
    if (stockIssue) {
      setCart(verifiedCart);
      if (verifiedCart.length === 0 && printJobs.length === 0) {
        toast.error(t('pos.cartEmpty'));
        return;
      }
      toast.warning(t('pos.cartAdjusted'));
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
      discount: discountAmount + loyaltyDiscount,
      total,
      paymentMethod,
      mobileProvider: (paymentMethod === 'mobile' || paymentMethod === 'split') && mobileProvider ? mobileProvider as MobileProvider : undefined,
      transactionReference: paymentMethod === 'mobile' && transactionReference ? transactionReference : undefined,
      cashTendered: paymentMethod === 'cash' ? cashTendered : undefined,
      changeDue: paymentMethod === 'cash' ? Math.max(0, cashTendered - total) : undefined,
      splitCashAmount: paymentMethod === 'split' ? splitCashAmount : undefined,
      splitMobileAmount: paymentMethod === 'split' ? splitMobileAmount : undefined,
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

    // Store last transaction for receipt viewing/printing
    setLastTransaction(tx);

    // Show change if cash
    if (paymentMethod === 'cash' && cashTendered > 0) {
      toast.success(t('pos.saleCompletedChange', { amount: formatCurrency(changeDue) }));
    } else {
      toast.success(t('pos.saleCompletedTotal', { amount: formatCurrency(total) }));
    }

    // Show receipt dialog
    setReceiptDialogOpen(true);

    setCart([]);
    setPrintJobs([]);
    setDiscountPercent(0);
    setSelectedCustomerId('');
    setCashTendered(0);
    setLoyaltyRedeem(0);
    setTransactionReference('');
    setSplitCashAmount(0);
    setSplitMobileAmount(0);
    setMobileProvider('');
  };

  // Keyboard shortcut: Enter to checkout
  const handleKeyboardCheckout = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey && (cart.length > 0 || printJobs.length > 0)) {
      handleCheckout();
    }
  }, [cart, printJobs, handleCheckout]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyboardCheckout);
    return () => window.removeEventListener('keydown', handleKeyboardCheckout);
  }, [handleKeyboardCheckout]);

  return (
    <div className="flex h-full animate-slide-in">
      {/* Product Grid */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">{t('pos.title')}</h1>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setDailyCloseOpen(true)}>
              <Clock size={16} /> {t('pos.dailyClose')}
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => {
              setPrintJobForm({ printType: 'bw', pageCount: 1, copies: 1, paperSize: 'A4', binding: 'none' });
              setPrintJobOpen(true);
            }}>
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
              {getAllCategories(settings.customCategories, settings.language).map(cat => (
                <SelectItem key={cat.key} value={cat.key}>{cat.icon} {(cat.key in CATEGORY_I18N_KEYS) ? t(CATEGORY_I18N_KEYS[cat.key as BuiltInCategory]) : cat.label}</SelectItem>
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
                <div className="text-2xl mb-2">{getCategoryIcon(p.category, settings.customCategories)}</div>
                <p className="font-medium text-sm truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{(p.category in CATEGORY_I18N_KEYS) ? t(CATEGORY_I18N_KEYS[p.category as BuiltInCategory]) : getCategoryLabel(p.category, settings.customCategories, settings.language)}</p>
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
      <div className="w-80 lg:w-96 bg-card border-l flex flex-col shrink-0">
        {/* Held Orders Bar */}
        {heldOrders.length > 0 && (
          <div className="px-3 pt-2 pb-1 border-b bg-muted/40">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 font-semibold flex items-center gap-1">
              <PauseCircle size={11} /> {t('pos.heldOrders')} ({heldOrders.length})
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {heldOrders.map(held => (
                <div key={held.id} className="flex items-center bg-background border rounded-full pl-2.5 pr-1 py-0.5 text-xs gap-1 shadow-sm">
                  <span className="max-w-[90px] truncate font-medium">{held.label}</span>
                  <span className="text-muted-foreground">({held.cart.reduce((s, c) => s + c.quantity, 0) + held.printJobs.length})</span>
                  <button
                    onClick={() => resumeHeldOrder(held)}
                    className="ml-0.5 text-primary hover:text-primary/80 p-0.5 rounded-full"
                    title={t('pos.orderResumed', { label: held.label })}
                  >
                    <PlayCircle size={13} />
                  </button>
                  <button
                    onClick={() => deleteHeldOrder(held.id)}
                    className="text-destructive hover:text-destructive/80 p-0.5 rounded-full"
                    title={t('pos.heldDiscarded')}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <ShoppingCart size={18} />
            {t('pos.currentSale')}
            {cart.length > 0 && (
              <span className={`text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full`}>
                {cart.reduce((s, c) => s + c.quantity, 0)}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-1">
            {(cart.length > 0 || printJobs.length > 0) && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-500" onClick={holdCurrentOrder} title={t('pos.holdOrder')}>
                <PauseCircle size={14} />
              </Button>
            )}
            {lastTransaction && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReceiptDialogOpen(true)} title={t('pos.lastReceipt')}>
                <Receipt size={14} />
              </Button>
            )}
            {(cart.length > 0 || printJobs.length > 0) && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={clearCart} title={t('pos.clearCart')}>
                <X size={14} />
              </Button>
            )}
          </div>
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
                <div key={item.product.id} className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(item.product.price)} {t('pos.each')}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateCartQty(item.product.id, -1)}>
                      <Minus size={12} />
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      max={item.product.category === 'services' ? undefined : item.product.quantity}
                      value={item.quantity}
                      onChange={e => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val > 0) setCartQtyDirect(item.product.id, val);
                      }}
                      className="h-7 w-14 text-center text-sm font-medium px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
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
                <div key={job.id} className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <Printer size={16} className="text-primary shrink-0" />
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
                {loyaltyRedeem > 0 && <span className="text-xs text-green-600 dark:text-green-400">-{formatCurrency(loyaltyDiscount)}</span>}
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
            <div className="flex justify-between font-bold text-lg pt-1 border-t"><span>{t('pos.total')}</span><span>{formatCurrency(total)}</span></div>
          </div>

          {/* Cash Tendered / Change */}
          {paymentMethod === 'cash' && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t('pos.cashTendered')}</span>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={cashTendered || ''}
                  onChange={e => setCashTendered(parseFloat(e.target.value) || 0)}
                  className={`h-8 flex-1 text-xs ${cashTendered > 0 && cashTendered < total ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  placeholder={t('pos.amountGiven')}
                />
              </div>
              {cashTendered > 0 && cashTendered >= total && (
                <div className="flex justify-between text-sm font-semibold text-green-600">
                  <span>{t('pos.changeDue')}</span>
                  <span>{formatCurrency(cashTendered - total)}</span>
                </div>
              )}
              {cashTendered > 0 && cashTendered < total && (
                <div className="flex justify-between text-sm font-semibold text-red-600">
                  <span>{t('pos.insufficientLabel')}</span>
                  <span>-{formatCurrency(total - cashTendered)}</span>
                </div>
              )}
            </div>
          )}

          {/* Split Payment Inputs */}
          {paymentMethod === 'split' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Banknote size={14} className="text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">{t('pos.splitCashAmount')}</span>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={splitCashAmount || ''}
                  onChange={e => {
                    const val = parseFloat(e.target.value) || 0;
                    setSplitCashAmount(val);
                    if (total > 0) setSplitMobileAmount(Math.round(total - val));
                  }}
                  className="h-8 flex-1 text-xs"
                  placeholder="0"
                />
              </div>
              <div className="flex items-center gap-2">
                <Smartphone size={14} className="text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">{t('pos.splitMobileAmount')}</span>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={splitMobileAmount || ''}
                  onChange={e => {
                    const val = parseFloat(e.target.value) || 0;
                    setSplitMobileAmount(val);
                    if (total > 0) setSplitCashAmount(Math.round(total - val));
                  }}
                  className="h-8 flex-1 text-xs"
                  placeholder="0"
                />
              </div>
              {splitCashAmount > 0 && splitMobileAmount > 0 && (
                <div className={`flex justify-between text-xs font-medium ${
                  Math.round(splitCashAmount + splitMobileAmount) >= Math.round(total)
                    ? 'text-green-600' : 'text-red-600'
                }`}>
                  <span>{t('pos.total')}: {formatCurrency(total)}</span>
                  <span>{t('pos.cash')}: {formatCurrency(splitCashAmount)} + {t('pos.mobile')}: {formatCurrency(splitMobileAmount)}</span>
                </div>
              )}
            </div>
          )}

          {/* Payment method buttons */}
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { v: 'cash' as const, icon: Banknote, label: t('pos.cash') },
              { v: 'mobile' as const, icon: Smartphone, label: t('pos.mobile') },
              { v: 'split' as const, icon: Split, label: t('pos.split') },
            ]).map(({ v, icon: Icon, label }) => (
              <button
                key={v}
                onClick={() => {
                  setPaymentMethod(v);
                  if (v === 'cash') { setTransactionReference(''); setMobileProvider(''); }
                }}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-colors ${
                  paymentMethod === v ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {/* Mobile provider selector */}
          {(paymentMethod === 'mobile' || paymentMethod === 'split') && (
            <div className="flex items-center gap-2">
              <Smartphone size={14} className="text-muted-foreground shrink-0" />
              <Select value={mobileProvider} onValueChange={v => setMobileProvider(v as MobileProvider)}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder={t('pos.selectProvider')} />
                </SelectTrigger>
                <SelectContent>
                  {MOBILE_PROVIDERS.map(p => (
                    <SelectItem key={p} value={p}>{t(MOBILE_PROVIDER_I18N_KEYS[p])}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Transaction reference for mobile */}
          {paymentMethod === 'mobile' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('pos.transactionRef')}</span>
              <Input
                type="text"
                value={transactionReference}
                onChange={e => setTransactionReference(e.target.value)}
                className="h-8 flex-1 text-xs"
                placeholder={t('pos.authCodePlaceholder')}
              />
            </div>
          )}

          <Button className="w-full h-12 text-base font-semibold" onClick={handleCheckout} disabled={cart.length === 0 && printJobs.length === 0} title="Ctrl+Enter">
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
                    <SelectItem value="bw">{t('pos.blackAndWhite', { price: Math.round(settings.bwPricePerPage) })}</SelectItem>
                    <SelectItem value="color">{t('pos.colorPrint', { price: Math.round(settings.colorPricePerPage) })}</SelectItem>
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

      {/* Receipt Dialog */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Receipt size={18} /> {t('pos.receiptTitle')}</DialogTitle>
          </DialogHeader>
          {lastTransaction && (
            <div className="space-y-3">
              <div className="text-center space-y-1">
                <p className="font-bold text-lg">{settings.storeName}</p>
                {settings.storeAddress && <p className="text-xs text-muted-foreground">{settings.storeAddress}</p>}
                {settings.storePhone && <p className="text-xs text-muted-foreground">Tel: {settings.storePhone}</p>}
              </div>
              <div className="border-t border-dashed" />
              <div className="text-xs space-y-0.5">
                <p>{t('pos.receiptRef')}: #{lastTransaction.id.slice(-6).toUpperCase()}</p>
                <p>{new Date(lastTransaction.timestamp).toLocaleString()}</p>
                {lastTransaction.cashierName && <p>{t('pos.cashierLabel')}: {lastTransaction.cashierName}</p>}
                {lastTransaction.customerName && <p>{t('pos.customerLabel')}: {lastTransaction.customerName}</p>}
              </div>
              <div className="border-t border-dashed" />
              <div className="space-y-1">
                {lastTransaction.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{getCategoryIcon(item.product.category, settings.customCategories)} {item.product.name} x{item.quantity}</span>
                    <span className="font-medium">{formatCurrency(item.product.price * item.quantity)}</span>
                  </div>
                ))}
                {lastTransaction.printJobs?.map((job, i) => (
                  <div key={`pj-${i}`} className="flex justify-between text-sm">
                    <span>🖨️ {job.printType === 'bw' ? t('pos.printBW') : t('pos.printColor')} ({job.pageCount}pg x{job.copies})</span>
                    <span className="font-medium">{formatCurrency(job.total)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed" />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>{t('pos.subtotal')}</span><span>{formatCurrency(lastTransaction.subtotal)}</span></div>
                {lastTransaction.discount > 0 && (
                  <div className="flex justify-between text-green-600"><span>{t('transactions.discount')}</span><span>-{formatCurrency(lastTransaction.discount)}</span></div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-1"><span>{t('pos.total')}</span><span>{formatCurrency(lastTransaction.total)}</span></div>
              </div>
              <div className="text-center text-xs text-muted-foreground">
                <p>{t('pos.paymentMethod')}: {lastTransaction.paymentMethod.toUpperCase()}{lastTransaction.mobileProvider ? ` (${t(MOBILE_PROVIDER_I18N_KEYS[lastTransaction.mobileProvider])})` : ''}</p>
                {lastTransaction.paymentMethod === 'cash' && lastTransaction.cashTendered != null && (
                  <>
                    <p>{t('pos.cashTendered')}: {formatCurrency(lastTransaction.cashTendered)}</p>
                    <p>{t('pos.changeDue')}: {formatCurrency(lastTransaction.changeDue || 0)}</p>
                  </>
                )}
                {lastTransaction.paymentMethod === 'split' && (
                  <p>{t('pos.cash')}: {formatCurrency(lastTransaction.splitCashAmount || 0)} | {t('pos.mobile')}: {formatCurrency(lastTransaction.splitMobileAmount || 0)}</p>
                )}
              </div>
              {settings.receiptFooter && (
                <>
                  <div className="border-t border-dashed" />
                  <p className="text-center text-xs text-muted-foreground">{settings.receiptFooter}</p>
                </>
              )}
            </div>
          )}
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="secondary" onClick={() => setReceiptDialogOpen(false)}>{t('common.close')}</Button>
            <Button className="gap-1" onClick={() => {
              if (lastTransaction) {
                const html = generateReceiptHTML(lastTransaction, settings);
                if (window.electronAPI) {
                  window.electronAPI.printReceipt(html);
                } else {
                  const win = window.open('', '_blank', 'width=350,height=600');
                  if (win) {
                    win.document.write(html);
                    win.document.close();
                    win.focus();
                    win.onload = () => win.print();
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
                      }, 100);
                    }
                  }
                }
              }
            }}>
              <Printer size={14} /> {t('pos.printReceipt')}
            </Button>
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
            <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString(isRTL ? 'ar' : 'en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <div className="space-y-2">
              <div className="flex justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm">{t('pos.totalTransactions')}</span>
                <span className="font-bold">{dailyStats.count}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                <span className="text-sm font-medium">{t('pos.totalRevenue')}</span>
                <span className="font-bold text-green-700 dark:text-green-400">{formatCurrency(dailyStats.totalRevenue)}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-sm text-muted-foreground">{t('pos.cash')}</span>
                <span className="font-medium">{formatCurrency(dailyStats.totalCash)}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-sm text-muted-foreground">{t('pos.mobile')}</span>
                <span className="font-medium">{formatCurrency(dailyStats.totalMobile)}</span>
              </div>
              {dailyStats.refundCount > 0 && (
                <div className="flex justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                  <span className="text-sm text-red-600 dark:text-red-400">{t('pos.refunds')}</span>
                  <span className="font-medium text-red-600 dark:text-red-400">{dailyStats.refundCount}</span>
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

      {/* Resume Held Order Confirmation */}
      <Dialog open={!!resumeConfirm} onOpenChange={open => { if (!open) setResumeConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('pos.resumeConfirmTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('pos.resumeConfirmDesc', { label: resumeConfirm?.label ?? '' })}
          </p>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => setResumeConfirm(null)}>
              {t('pos.cancelResume')}
            </Button>
            <Button onClick={() => {
              if (resumeConfirm) {
                doResumeHeldOrder(resumeConfirm, true);
                setResumeConfirm(null);
              }
            }}>
              {t('pos.holdAndResume')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
