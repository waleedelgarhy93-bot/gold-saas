import React, { useEffect, useMemo, useState } from 'react';
import type {
  Role, JewelryType, InventoryItem, InventorySection, CapitalSummary,
  CashTransactionRecord, InventorySummary,
} from '../types';
import {
  fetchJewelryTypes, createJewelryType, fetchInventory, addInventoryItem,
  updateInventoryItem, deleteInventoryItem, resetInventoryAPI, fetchCapital, fetchInventorySummary,
  fetchCashTransactions, addCashTransaction, updateOpeningCash,
} from '../api';
import {
  Package, Plus, Trash2, Pencil, Wallet, Scale, Coins, X, Save,
  Search, Layers, ArrowDownLeft, ArrowUpRight, Receipt, AlertCircle, RotateCcw,
} from 'lucide-react';

interface InventoryViewProps {
  role: Role;
}

type TabKey = 'new' | 'scrap' | 'sold' | 'cash';

interface ItemFormState {
  type_id: string;
  type_name: string;
  name: string;
  karat: number;
  gross_weight: string;
  stones_weight: string;
  purchase_price_per_gram: string;
  workmanship_per_gram: string;
  brand: string;
  serial_number: string;
  notes: string;
  section: InventorySection;
  paid_from_cash: boolean;
}

const emptyForm = (section: InventorySection): ItemFormState => ({
  type_id: '',
  type_name: '',
  name: '',
  karat: 21,
  gross_weight: '',
  stones_weight: '0',
  purchase_price_per_gram: '',
  workmanship_per_gram: '',
  brand: '',
  serial_number: '',
  notes: '',
  section,
  paid_from_cash: false,
});

const money = (value: number | null | undefined) =>
  (value || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 });

const weight = (value: number | null | undefined) =>
  `${(value || 0).toFixed(3)} g`;

export const InventoryView: React.FC<InventoryViewProps> = ({ role }) => {
  const isAdmin = role !== 'cashier';

  const [types, setTypes] = useState<JewelryType[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [soldItems, setSoldItems] = useState<InventoryItem[]>([]);
  const [capital, setCapital] = useState<CapitalSummary | null>(null);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [transactions, setTransactions] = useState<CashTransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<TabKey>('new');
  const [search, setSearch] = useState('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetScope, setResetScope] = useState<'in_stock' | 'all'>('all');
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleResetInventory = async () => {
    if (resetConfirmInput.trim() !== 'تصفير') {
      setResetError('من فضلك اكتب كلمة "تصفير" للتأكيد');
      return;
    }
    setResetting(true);
    setResetError(null);
    const res = await resetInventoryAPI(resetScope);
    setResetting(false);
    if (res.ok) {
      setIsResetModalOpen(false);
      setResetConfirmInput('');
      await loadAll();
      alert(res.message || 'تم تصفير المخزن والنقدية بالكامل بنجاح!');
    } else {
      setResetError(res.error || 'فشل تصفير المخزن');
    }
  };

  const [typeFilter, setTypeFilter] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ItemFormState>(emptyForm('new'));
  const [saving, setSaving] = useState(false);

  const [newTypeName, setNewTypeName] = useState('');

  const [openingCashInput, setOpeningCashInput] = useState('0');
  const [txDirection, setTxDirection] = useState<'in' | 'out'>('in');
  const [txAmount, setTxAmount] = useState('');
  const [txNote, setTxNote] = useState('');

  const loadAll = async () => {
    setLoading(true);
    const [typesData, inStock, sold, capitalData, summaryData, txData] = await Promise.all([
      fetchJewelryTypes(),
      fetchInventory({ status: 'in_stock' }),
      fetchInventory({ status: 'sold' }),
      fetchCapital(),
      fetchInventorySummary(),
      fetchCashTransactions(),
    ]);
    setTypes(typesData);
    setItems(inStock);
    setSoldItems(sold);
    setCapital(capitalData);
    setSummary(summaryData);
    setTransactions(txData);
    setOpeningCashInput(String(capitalData?.opening_cash ?? 0));
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const buyPrices = capital?.prices_used.karat_buy_prices || {};
  const priceForKarat = (karat: number) => buyPrices[String(karat)] || buyPrices['21'] || 0;

  const openAddForm = () => {
    setEditingId(null);
    setForm(emptyForm(tab === 'cash' || tab === 'sold' ? 'new' : tab));
    setIsFormOpen(true);
  };

  const openEditForm = (item: InventoryItem) => {
    setEditingId(item.id);
    setForm({
      type_id: item.type_id ? String(item.type_id) : '',
      type_name: item.type_name || '',
      name: item.name || '',
      karat: item.karat,
      gross_weight: String(item.gross_weight ?? ''),
      stones_weight: String(item.stones_weight ?? '0'),
      purchase_price_per_gram: String(item.purchase_price_per_gram ?? ''),
      workmanship_per_gram: String(item.workmanship_per_gram ?? ''),
      brand: item.brand || '',
      serial_number: item.serial_number || '',
      notes: item.notes || '',
      section: item.section,
      paid_from_cash: item.paid_from_cash,
    });
    setIsFormOpen(true);
  };

  const handleSaveItem = async () => {
    const gross = parseFloat(form.gross_weight) || 0;
    if (gross <= 0) {
      alert('أدخل الوزن القائم للقطعة');
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      section: form.section,
      type_id: form.type_id ? Number(form.type_id) : null,
      type_name: form.type_id ? null : form.type_name || null,
      name: form.name || form.type_name || undefined,
      karat: form.karat,
      gross_weight: gross,
      stones_weight: parseFloat(form.stones_weight) || 0,
      purchase_price_per_gram: parseFloat(form.purchase_price_per_gram) || 0,
      workmanship_per_gram: parseFloat(form.workmanship_per_gram) || 0,
      brand: form.brand || null,
      serial_number: form.serial_number || null,
      notes: form.notes || null,
      paid_from_cash: editingId ? undefined : form.paid_from_cash,
    };
    if (!editingId) payload.source = 'purchase';

    const result = editingId
      ? await updateInventoryItem(editingId, payload)
      : await addInventoryItem(payload);

    setSaving(false);
    if (!result.ok) {
      alert(result.error || 'حدث خطأ أثناء الحفظ');
      return;
    }
    setIsFormOpen(false);
    setEditingId(null);
    await loadAll();
  };

  const handleDeleteItem = async (item: InventoryItem) => {
    if (!confirm(`حذف "${item.name}" من المخزن نهائياً؟`)) return;
    const result = await deleteInventoryItem(item.id);
    if (!result.ok) {
      alert(result.error || 'تعذر الحذف');
      return;
    }
    await loadAll();
  };

  const handleAddType = async () => {
    const name = newTypeName.trim();
    if (!name) return;
    const result = await createJewelryType(name);
    if (!result.ok) {
      alert(result.error || 'تعذر إضافة النوع');
      return;
    }
    setNewTypeName('');
    const fresh = await fetchJewelryTypes();
    setTypes(fresh);
    if (result.type) setForm((prev) => ({ ...prev, type_id: String(result.type!.id) }));
  };

  const handleSaveOpeningCash = async () => {
    const value = parseFloat(openingCashInput) || 0;
    const ok = await updateOpeningCash(value);
    if (!ok) {
      alert('تعذر تحديث النقدية الافتتاحية');
      return;
    }
    await loadAll();
  };

  const handleAddTransaction = async () => {
    const amount = parseFloat(txAmount) || 0;
    if (amount <= 0) {
      alert('أدخل مبلغاً صحيحاً');
      return;
    }
    const result = await addCashTransaction({
      direction: txDirection,
      amount,
      note: txNote || undefined,
      category: txDirection === 'in' ? 'deposit' : 'expense',
    });
    if (!result.ok) {
      alert(result.error || 'تعذر تسجيل الحركة');
      return;
    }
    setTxAmount('');
    setTxNote('');
    await loadAll();
  };

  const visibleItems = useMemo(() => {
    const source = tab === 'sold' ? soldItems : items.filter((i) => i.section === tab);
    const term = search.trim().toLowerCase();
    return source.filter((item) => {
      if (typeFilter && String(item.type_id || '') !== typeFilter) return false;
      if (!term) return true;
      return (
        (item.name || '').toLowerCase().includes(term) ||
        (item.type_name || '').toLowerCase().includes(term) ||
        (item.brand || '').toLowerCase().includes(term) ||
        (item.serial_number || '').toLowerCase().includes(term)
      );
    });
  }, [tab, items, soldItems, search, typeFilter]);

  const currentSectionStats = tab === 'new'
    ? capital?.new_gold
    : tab === 'scrap'
      ? capital?.scrap_gold
      : null;

  const tabButton = (key: TabKey, label: string, icon: React.ReactNode, badge?: number) => (
    <button
      onClick={() => { setTab(key); setTypeFilter(''); }}
      className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition cursor-pointer ${
        tab === key
          ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
          : 'text-slate-300 hover:text-amber-300 hover:bg-slate-800'
      }`}
    >
      {icon}
      <span>{label}</span>
      {typeof badge === 'number' && badge > 0 && (
        <span className={`text-[10px] font-mono px-1.5 rounded-full ${tab === key ? 'bg-slate-950/20' : 'bg-slate-800'}`}>
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-md">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-400" />
            <span>المخزن ورأس المال</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            الجديد والكسر والمباع — أي قطعة تتباع تنقص من المخزن تلقائياً وتنتقل للمباع
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setIsResetModalOpen(true)}
              className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
              title="تصفير أرصدة المخزن"
            >
              <RotateCcw className="w-4 h-4 text-rose-400" />
              <span>تصفير المخزن</span>
            </button>
          )}
          <button
            onClick={openAddForm}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>إضافة قطعة للمخزن</span>
          </button>
        </div>
      </div>

      {/* Capital cards */}
      {isAdmin && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-slate-900/90 rounded-2xl p-4 border border-amber-900/30 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
              <Package className="w-3.5 h-3.5" />
              <span>ذهب جديد</span>
            </div>
            <div className="text-lg font-black font-mono text-amber-200">{money(capital?.new_gold.value)}</div>
            <p className="text-[10px] text-slate-500">
              {capital?.new_gold.count || 0} قطعة · {weight(capital?.new_gold.net_weight)}
            </p>
          </div>

          <div className="bg-slate-900/90 rounded-2xl p-4 border border-rose-900/30 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-rose-400">
              <Scale className="w-3.5 h-3.5" />
              <span>كسر</span>
            </div>
            <div className="text-lg font-black font-mono text-rose-200">{money(capital?.scrap_gold.value)}</div>
            <p className="text-[10px] text-slate-500">
              {capital?.scrap_gold.count || 0} قطعة · {weight(capital?.scrap_gold.net_weight)}
            </p>
          </div>

          <div className="bg-slate-900/90 rounded-2xl p-4 border border-emerald-900/30 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <Wallet className="w-3.5 h-3.5" />
              <span>النقدية</span>
            </div>
            <div className={`text-lg font-black font-mono ${(capital?.cash || 0) < 0 ? 'text-rose-300' : 'text-emerald-200'}`}>
              {money(capital?.cash)}
            </div>
            <p className="text-[10px] text-slate-500">رصيد الدرج الحالي</p>
          </div>

          <div className="bg-slate-900/90 rounded-2xl p-4 border border-sky-900/30 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-sky-400">
              <Receipt className="w-3.5 h-3.5" />
              <span>باقي عند العملاء</span>
            </div>
            <div className="text-lg font-black font-mono text-sky-200">{money(capital?.receivables)}</div>
            <p className="text-[10px] text-slate-500">مبالغ لم تُحصَّل بعد</p>
          </div>

          <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-amber-500/15 via-slate-900 to-slate-950 rounded-2xl p-4 border border-amber-500/40 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-amber-300">
              <Coins className="w-3.5 h-3.5" />
              <span>إجمالي رأس المال</span>
            </div>
            <div className="text-xl font-black font-mono text-amber-300">{money(capital?.total_capital)}</div>
            <p className="text-[10px] text-amber-500/70">جديد + كسر + نقدية + متأخرات</p>
          </div>
        </div>
      )}

      {/* Tabs + filters */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-slate-900/90 p-2.5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {tabButton('new', 'جديد', <Package className="w-4 h-4" />, summary?.new.count)}
          {tabButton('scrap', 'كسر', <Scale className="w-4 h-4" />, summary?.scrap.count)}
          {tabButton('sold', 'المباع', <Receipt className="w-4 h-4" />, summary?.sold.count)}
          {isAdmin && tabButton('cash', 'النقدية', <Wallet className="w-4 h-4" />)}
        </div>

        {tab !== 'cash' && (
          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="">كل الأنواع</option>
              {types.map((t) => (
                <option key={t.id} value={String(t.id)}>{t.name}</option>
              ))}
            </select>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بالاسم أو السيريال..."
                className="bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 w-44 sm:w-64"
              />
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm">جاري تحميل المخزن...</div>
      ) : tab === 'cash' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Opening cash + new transaction */}
          <div className="space-y-6">
            <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>النقدية الافتتاحية للدرج</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                الرصيد اللي بدأت بيه المحل قبل أي مبيعات أو مشتريات.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={openingCashInput}
                  onChange={(e) => setOpeningCashInput(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleSaveOpeningCash}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>حفظ</span>
                </button>
              </div>
              <div className="flex justify-between items-center text-xs bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2">
                <span className="text-slate-400">رصيد النقدية الحالي:</span>
                <span className={`font-mono font-bold ${(capital?.cash || 0) < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                  {money(capital?.cash)} ج.م
                </span>
              </div>
            </div>

            <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                <span>تسجيل حركة نقدية</span>
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTxDirection('in')}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border cursor-pointer ${
                    txDirection === 'in'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>إيداع / دخل</span>
                </button>
                <button
                  onClick={() => setTxDirection('out')}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border cursor-pointer ${
                    txDirection === 'out'
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>سحب / مصروف</span>
                </button>
              </div>
              <input
                type="number"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                placeholder="المبلغ بالجنيه"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-amber-500"
              />
              <input
                value={txNote}
                onChange={(e) => setTxNote(e.target.value)}
                placeholder="ملاحظة (اختياري)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={handleAddTransaction}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
              >
                تسجيل الحركة
              </button>
            </div>
          </div>

          {/* Transactions list */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-200">آخر الحركات النقدية اليدوية</h3>
            </div>
            {transactions.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs">لا توجد حركات مسجلة</div>
            ) : (
              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="p-3">النوع</th>
                      <th className="p-3">المبلغ</th>
                      <th className="p-3">ملاحظة</th>
                      <th className="p-3">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-800/40">
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] ${
                            tx.direction === 'in'
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                          }`}>
                            {tx.direction === 'in' ? 'دخل' : 'خرج'}
                          </span>
                        </td>
                        <td className={`p-3 font-mono font-bold ${tx.direction === 'in' ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {tx.direction === 'in' ? '+' : '-'} {money(tx.amount)}
                        </td>
                        <td className="p-3 text-slate-400">{tx.note || '—'}</td>
                        <td className="p-3 text-slate-500 text-[10px]">
                          {tx.created_at ? new Date(tx.created_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-md overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-200">
              {tab === 'new' ? 'مخزن الذهب الجديد' : tab === 'scrap' ? 'مخزن الكسر' : 'القطع المباعة'}
              <span className="text-xs text-slate-400 font-normal mr-2">({visibleItems.length} قطعة)</span>
            </h3>
            {currentSectionStats && (
              <div className="flex items-center gap-4 text-[11px]">
                <span className="text-slate-400">الوزن: <b className="text-amber-300 font-mono">{weight(currentSectionStats.net_weight)}</b></span>
                {isAdmin && <span className="text-slate-400">القيمة: <b className="text-amber-300 font-mono">{money(currentSectionStats.value)} ج.م</b></span>}
              </div>
            )}
          </div>

          {visibleItems.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              {tab === 'sold' ? 'لا توجد قطع مباعة بعد' : 'المخزن فاضي — اضغط "إضافة قطعة للمخزن"'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3">النوع</th>
                    <th className="p-3">الاسم</th>
                    <th className="p-3">العيار</th>
                    <th className="p-3">الوزن الصافي</th>
                    {isAdmin && <th className="p-3">تكلفة الجرام</th>}
                    {isAdmin && <th className="p-3">القيمة الحالية</th>}
                    {tab === 'sold' && <th className="p-3">سعر البيع</th>}
                    {tab === 'sold' && <th className="p-3">الفاتورة</th>}
                    <th className="p-3">التاريخ</th>
                    {tab !== 'sold' && <th className="p-3 text-center">إجراءات</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {visibleItems.map((item) => {
                    const currentValue = (item.net_weight || 0) * priceForKarat(item.karat);
                    return (
                      <tr key={item.id} className="hover:bg-slate-800/40">
                        <td className="p-3 text-slate-400 font-sans">{item.type_name || '—'}</td>
                        <td className="p-3 font-sans font-medium text-slate-200">
                          {item.name}
                          {item.serial_number && (
                            <span className="block text-[10px] text-slate-500 font-mono">{item.serial_number}</span>
                          )}
                        </td>
                        <td className="p-3 text-amber-400 font-bold">عيار {item.karat}</td>
                        <td className="p-3 text-slate-200 font-mono">{weight(item.net_weight)}</td>
                        {isAdmin && <td className="p-3 text-slate-400 font-mono">{money(item.purchase_price_per_gram)}</td>}
                        {isAdmin && <td className="p-3 text-amber-300 font-mono font-bold">{money(currentValue)}</td>}
                        {tab === 'sold' && <td className="p-3 text-emerald-300 font-mono font-bold">{money(item.sold_price)}</td>}
                        {tab === 'sold' && <td className="p-3 text-slate-400 font-mono">#{item.sold_invoice_id ?? '—'}</td>}
                        <td className="p-3 text-slate-500 text-[10px]">
                          {new Date(tab === 'sold' && item.sold_at ? item.sold_at : item.created_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        {tab !== 'sold' && (
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openEditForm(item)}
                                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-amber-300 rounded-lg transition cursor-pointer"
                                title="تعديل"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item)}
                                className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 rounded-lg transition cursor-pointer"
                                title="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add / edit item modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-amber-900/40 rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                <span>{editingId ? 'تعديل قطعة' : 'إضافة قطعة للمخزن'}</span>
              </h2>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="col-span-2">
                <label className="block text-slate-400 mb-1">النوع</label>
                <select
                  value={form.type_id}
                  onChange={(e) => setForm({ ...form, type_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">— اختر النوع —</option>
                  {types.map((t) => (
                    <option key={t.id} value={String(t.id)}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-slate-400 mb-1">إضافة نوع جديد</label>
                <div className="flex gap-2">
                  <input
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    placeholder="مثال: توكة، حظاظة..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={handleAddType}
                    className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-3 rounded-xl text-xs cursor-pointer"
                  >
                    إضافة
                  </button>
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-slate-400 mb-1">اسم/وصف القطعة</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: غويشة عيار 21"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">القسم</label>
                <select
                  value={form.section}
                  onChange={(e) => setForm({ ...form, section: e.target.value as InventorySection })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="new">جديد</option>
                  <option value="scrap">كسر</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">العيار</label>
                <select
                  value={form.karat}
                  onChange={(e) => setForm({ ...form, karat: parseInt(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-bold focus:outline-none focus:border-amber-500"
                >
                  <option value={24}>24</option>
                  <option value={21}>21</option>
                  <option value={18}>18</option>
                  <option value={14}>14</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">الوزن القائم (g)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.gross_weight}
                  onChange={(e) => setForm({ ...form, gross_weight: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">خصم فصوص (g)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.stones_weight}
                  onChange={(e) => setForm({ ...form, stones_weight: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">تكلفة الجرام</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.purchase_price_per_gram}
                  onChange={(e) => setForm({ ...form, purchase_price_per_gram: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">مصنعية الجرام (اختياري)</label>
                <input
                  type="number"
                  step="1"
                  value={form.workmanship_per_gram}
                  onChange={(e) => setForm({ ...form, workmanship_per_gram: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">الماركة (اختياري)</label>
                <input
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">السيريال (اختياري)</label>
                <input
                  value={form.serial_number}
                  onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {!editingId && (
                <label className="col-span-2 flex items-center gap-2 bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.paid_from_cash}
                    onChange={(e) => setForm({ ...form, paid_from_cash: e.target.checked })}
                    className="accent-amber-500"
                  />
                  <span className="text-[11px] text-slate-300">دفعت قيمتها من درج النقدية</span>
                </label>
              )}

              <div className="col-span-2">
                <label className="block text-slate-400 mb-1">ملاحظات</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {form.purchase_price_per_gram && form.gross_weight && (
              <div className="text-[11px] text-slate-400 bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 flex justify-between">
                <span>إجمالي تكلفة القطعة:</span>
                <span className="font-mono text-amber-300">
                  {money(
                    Math.max(0, (parseFloat(form.gross_weight) || 0) - (parseFloat(form.stones_weight) || 0)) *
                    (parseFloat(form.purchase_price_per_gram) || 0)
                  )} ج.م
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer">
                إلغاء
              </button>
              <button
                onClick={handleSaveItem}
                disabled={saving}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'جاري الحفظ...' : editingId ? 'حفظ التعديلات' : 'إضافة للمخزن'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hint for cashier */}
      {!isAdmin && (
        <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2">
          <AlertCircle className="w-4 h-4 text-amber-500/70" />
          <span>الأسعار والتكلفة ورأس المال ظاهرة لصاحب المحل فقط. الكاشير يقدر يشوف القطع ويختار منها أثناء البيع.</span>
        </div>
      )}
    
      {/* Reset Inventory Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-rose-900/50 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertCircle className="w-5 h-5" />
                <h2 className="text-sm font-bold text-slate-100">تصفير أرصدة المخزن</h2>
              </div>
              <button
                onClick={() => { setIsResetModalOpen(false); setResetError(null); }}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-200 leading-relaxed">
              ⚠️ <strong>تحذير أمني ومحاسبي:</strong> هذه العملية ستقوم بتصفير المخزن (القطع والجرامات = 0) وتصفير رصيد النقدية والخزينة تماماً ليصبح 0.00 ج.م.
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-slate-300 font-bold">نطاق التصفير:</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setResetScope('in_stock')}
                  className={`p-3 rounded-xl border text-right transition cursor-pointer ${
                    resetScope === 'in_stock'
                      ? 'bg-rose-500/20 border-rose-500 text-rose-200 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold">تصفير المعروض + النقدية</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">تصفير قطع العرض وتصفير الخزينة</div>
                </button>
                <button
                  type="button"
                  onClick={() => setResetScope('all')}
                  className={`p-3 rounded-xl border text-right transition cursor-pointer ${
                    resetScope === 'all'
                      ? 'bg-rose-500/20 border-rose-500 text-rose-200 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold">تصفير شامل (مخزن + نقدية)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">مسح المخزن وتصفير الخزينة 0 ج.م</div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                لتأكيد العملية، اكتب كلمة <strong className="text-rose-400 font-bold">تصفير</strong> في المربع أدناه:
              </label>
              <input
                type="text"
                value={resetConfirmInput}
                onChange={(e) => setResetConfirmInput(e.target.value)}
                placeholder="اكتب: تصفير"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-center text-sm font-bold text-rose-300 focus:outline-none focus:border-rose-500"
              />
            </div>

            {resetError && <p className="text-xs text-rose-400 font-bold">{resetError}</p>}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => { setIsResetModalOpen(false); setResetError(null); }}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleResetInventory}
                disabled={resetting || resetConfirmInput.trim() !== 'تصفير'}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                <RotateCcw className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} />
                <span>{resetting ? 'جاري التصفير...' : 'تصفير المخزن الآن'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
</div>
  );
};
