import React, { useState } from 'react';
import { createInvoiceAPI } from '../api';

// النسخة القديمة من التطبيق كانت لما السيرفر يرفض الفاتورة تحفظها على الجهاز بس
// (localStorage: gold_invoices) وتطبعها بوزن وإجمالي صفر. هنا بنلاقي الفواتير دي
// ونرفعها للسيرفر بتاريخها الأصلي، والسيرفر بيمنع رفع نفس الفاتورة مرتين.

const STORAGE_KEY = 'gold_invoices';

interface LocalInvoice {
  id: number;
  invoice_number?: string;
  invoice_type?: string;
  created_at?: string;
  customer_name?: string;
  items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

function readLocal(): LocalInvoice[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

// الفواتير المحلية رقمها كان Date.now() (رقم كبير جداً) ومعاها أصناف
function isPending(inv: LocalInvoice): boolean {
  return typeof inv.id === 'number' && inv.id > 1e12 && Array.isArray(inv.items) && inv.items.length > 0;
}

function removeFromLocal(id: number) {
  const left = readLocal().filter((i) => i.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(left));
}

export const PendingLocalInvoicesBanner: React.FC = () => {
  const [pending, setPending] = useState<LocalInvoice[]>(() => readLocal().filter(isPending));
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ ok: number; failed: { id: number; label: string; error: string }[] } | null>(null);

  if (pending.length === 0 && !result) return null;

  const oldest = pending
    .map((i) => i.created_at)
    .filter(Boolean)
    .sort()[0];

  const handleUpload = async () => {
    const ok = window.confirm(
      `هيتم رفع ${pending.length} فاتورة للسيرفر بتاريخها الأصلي، وهتتخصم من المخزن وتتحسب في الخزينة زي أي فاتورة.\n\nمتأكد؟`
    );
    if (!ok) return;
    setUploading(true);
    let done = 0;
    const failed: { id: number; label: string; error: string }[] = [];
    for (const inv of pending) {
      const label = `${inv.invoice_number || inv.id} (${inv.customer_name || 'عميل نقدي'})`;
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, invoice_number, created_at, ...payload } = inv;
        await createInvoiceAPI({
          ...payload,
          offline_ref: String(id),
          original_created_at: created_at,
        });
        removeFromLocal(inv.id);
        done += 1;
      } catch (e) {
        failed.push({ id: inv.id, label, error: e instanceof Error ? e.message : 'خطأ غير معروف' });
      }
    }
    setUploading(false);
    setResult({ ok: done, failed });
    setPending(readLocal().filter(isPending));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 no-print" dir="rtl">
      {pending.length > 0 && (
        <div className="bg-amber-950/60 border border-amber-500/50 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-amber-100 space-y-1">
            <p className="font-bold">
              ⚠️ فيه {pending.length} فاتورة متسجلة على الجهاز ده بس ومش على السيرفر
            </p>
            <p className="text-xs text-amber-200/80">
              اتعملت وقت مشكلة في الاتصال{oldest ? ` (من ${new Date(oldest).toLocaleDateString('ar-EG')})` : ''}، وعشان كده ممكن تكون اتطبعت بوزن وإجمالي صفر.
              ارفعها دلوقتي عشان تتسجل في الفواتير والمخزن والخزينة.
            </p>
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-sm cursor-pointer disabled:opacity-60"
          >
            {uploading ? 'جاري الرفع...' : 'ارفع الفواتير للسيرفر'}
          </button>
        </div>
      )}

      {result && (
        <div className="mt-3 bg-slate-900 border border-slate-700 rounded-2xl p-4 text-sm space-y-1">
          {result.ok > 0 && <p className="text-emerald-300">✅ اترفع {result.ok} فاتورة بنجاح، وتلاقيها في قسم الفواتير.</p>}
          {result.failed.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-rose-300">❌ {f.label}: {f.error}</span>
              <button
                onClick={() => {
                  if (!window.confirm('الفاتورة دي هتتمسح من الجهاز ومش هتترفع للسيرفر. متأكد؟')) return;
                  removeFromLocal(f.id);
                  setPending(readLocal().filter(isPending));
                  setResult({ ...result, failed: result.failed.filter((x) => x.id !== f.id) });
                }}
                className="text-slate-300 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded-lg cursor-pointer"
              >
                امسحها من الجهاز
              </button>
            </div>
          ))}
          {result.failed.length > 0 && (
            <p className="text-xs text-slate-400">الفواتير اللي ما اترفعتش لسه محفوظة على الجهاز. صلّح المشكلة واضغط "ارفع" تاني.</p>
          )}
          <button onClick={() => setResult(null)} className="text-xs text-slate-400 underline cursor-pointer">إخفاء</button>
        </div>
      )}
    </div>
  );
};
