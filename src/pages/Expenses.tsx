import { useState, useMemo } from 'react';
import { generateId, addAuditLog } from '@/lib/storage';
import { useDataStore } from '@/lib/dataStore';
import { useI18n } from '@/lib/i18nContext';
import { Expense, ExpenseCategory, EXPENSE_CATEGORY_I18N_KEYS, Supplier } from '@/types/pos';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Search, Pencil, Trash2, Receipt, Calendar, TrendingDown, DollarSign, Filter,
} from 'lucide-react';
import { toast } from 'sonner';

const emptyExpense: Partial<Expense> = {
  description: '', category: 'other', amount: 0, date: new Date().toISOString().slice(0, 10), notes: '',
};

export default function Expenses() {
  const { user } = useAuth();
  const { expenses, suppliers, addExpense, updateExpense, deleteExpense } = useDataStore();
  const { t, formatCurrency, isRTL } = useI18n();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<Partial<Expense>>(emptyExpense);

  // Available months
  const months = useMemo(() => {
    const monthSet = new Set<string>();
    expenses.forEach(e => {
      const d = new Date(e.date);
      monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    return Array.from(monthSet).sort().reverse();
  }, [expenses]);

  const filtered = useMemo(() => {
    return expenses.filter(e => {
      const q = search.toLowerCase();
      const matchSearch = !search || e.description.toLowerCase().includes(q) || (e.notes && e.notes.toLowerCase().includes(q));
      const matchCategory = categoryFilter === 'all' || e.category === categoryFilter;
      const matchMonth = monthFilter === 'all' || e.date.startsWith(monthFilter);
      return matchSearch && matchCategory && matchMonth;
    });
  }, [expenses, search, categoryFilter, monthFilter]);

  // Monthly summary
  const monthlySummary = useMemo(() => {
    const totals: Record<string, number> = {};
    filtered.forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
    });
    const total = Object.values(totals).reduce((s, v) => s + v, 0);
    return { totals, total };
  }, [filtered]);

  const openAdd = () => { setEditing(null); setForm({ ...emptyExpense, date: new Date().toISOString().slice(0, 10) }); setDialogOpen(true); };
  const openEdit = (e: Expense) => { setEditing(e); setForm(e); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.description?.trim()) { toast.error(t('expenses.descriptionRequired')); return; }
    if (!form.amount || form.amount <= 0) { toast.error(t('expenses.amountPositive')); return; }
    const now = new Date().toISOString();
    if (editing) {
      const updated = { ...editing, ...form, updatedAt: now } as Expense;
      updateExpense(updated);
      addAuditLog('expense_edit', `Updated expense "${updated.description}"`, user?.id, user?.displayName);
      toast.success(t('expenses.expenseUpdated'));
    } else {
      const newExpense: Expense = {
        id: generateId(),
        description: form.description!.trim(),
        category: (form.category || 'other') as ExpenseCategory,
        amount: form.amount!,
        date: form.date || now.slice(0, 10),
        supplierId: form.supplierId,
        supplierName: form.supplierName,
        notes: form.notes || '',
        createdAt: now,
        updatedAt: now,
      };
      addExpense(newExpense);
      addAuditLog('expense_add', `Added expense "${newExpense.description}": ${formatCurrency(newExpense.amount)}`, user?.id, user?.displayName);
      toast.success(t('expenses.expenseAdded'));
    }
    setDialogOpen(false);
  };

  const handleDelete = (e: Expense) => {
    deleteExpense(e.id);
    addAuditLog('expense_delete', `Deleted expense "${e.description}"`, user?.id, user?.displayName);
    toast.success(t('expenses.expenseDeleted'));
  };

  const categoryColors: Record<string, string> = {
    rent: 'bg-blue-100 text-blue-700',
    utilities: 'bg-yellow-100 text-yellow-700',
    supplies: 'bg-green-100 text-green-700',
    salary: 'bg-purple-100 text-purple-700',
    marketing: 'bg-pink-100 text-pink-700',
    maintenance: 'bg-orange-100 text-orange-700',
    other: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="p-6 space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('expenses.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('expenses.expensesTracked', { count: expenses.length })}</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus size={16} /> {t('expenses.add')}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="pos-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('expenses.totalExpenses')}</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(monthlySummary.total)}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted text-red-600">
              <TrendingDown size={20} />
            </div>
          </div>
        </div>
        {Object.entries(monthlySummary.totals).slice(0, 3).map(([cat, total]) => (
          <div key={cat} className="pos-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t(EXPENSE_CATEGORY_I18N_KEYS[cat as ExpenseCategory])}</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(total)}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted text-amber-600">
                <DollarSign size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
          <Input placeholder={t('expenses.searchExpenses')} value={search} onChange={e => setSearch(e.target.value)} className={isRTL ? 'pr-9' : 'pl-9'} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter size={14} className={isRTL ? 'ml-1' : 'mr-1'} />
            <SelectValue placeholder={t('expenses.category')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('expenses.allCategories')}</SelectItem>
            {Object.entries(EXPENSE_CATEGORY_I18N_KEYS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{t(v)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-[160px]">
            <Calendar size={14} className={isRTL ? 'ml-1' : 'mr-1'} />
            <SelectValue placeholder={t('expenses.date')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('expenses.allMonths')}</SelectItem>
            {months.map(m => (
              <SelectItem key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en', { month: 'long', year: 'numeric' })}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Expense List */}
      {filtered.length === 0 ? (
        <div className="pos-card p-12 flex flex-col items-center text-muted-foreground">
          <Receipt size={48} className="opacity-30 mb-3" />
          <p>{t('expenses.noExpensesFound')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(e => (
            <div key={e.id} className="pos-card p-4 flex items-center gap-4">
              <div className={`px-2.5 py-1 rounded-md text-xs font-medium ${categoryColors[e.category] || categoryColors.other}`}>
                {t(EXPENSE_CATEGORY_I18N_KEYS[e.category])}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{e.description}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(e.date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {e.supplierName && ` · ${e.supplierName}`}
                </p>
              </div>
              <p className="text-lg font-bold text-red-600 shrink-0">{formatCurrency(e.amount)}</p>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)}>
                  <Pencil size={14} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(e)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expense Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t('expenses.editExpense') : t('expenses.add')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('expenses.description')} *</Label>
              <Input value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder={t('expenses.whatExpense')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('expenses.category')}</Label>
                <Select value={form.category || 'other'} onValueChange={v => setForm(p => ({ ...p, category: v as ExpenseCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXPENSE_CATEGORY_I18N_KEYS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{t(v)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('expenses.amountCurrency', { currency: t('common.currency') })} *</Label>
                <Input type="number" step="0.001" min="0" value={form.amount || ''} onChange={e => setForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('expenses.date')}</Label>
                <Input type="date" value={form.date || ''} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <Label>{t('expenses.supplierOptional')}</Label>
                <Select value={form.supplierId || ''} onValueChange={v => {
                  const sup = suppliers.find(s => s.id === v);
                  setForm(p => ({ ...p, supplierId: v || undefined, supplierName: sup?.name || undefined }));
                }}>
                  <SelectTrigger><SelectValue placeholder={t('expenses.none')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t('expenses.none')}</SelectItem>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t('common.notes')}</Label>
              <Input value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder={t('expenses.optionalNotes')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>{editing ? t('common.update') : t('expenses.add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
