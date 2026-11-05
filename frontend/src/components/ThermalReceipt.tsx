import React from 'react';
import type { Invoice, ShopInfo } from '../types';

interface ThermalReceiptProps {
  invoice: Invoice | null;
  shopInfo?: ShopInfo | null;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ invoice, shopInfo }) => {
  if (!invoice) return null;

  const shopName = shopInfo?.name || 'مجوهرات الهدى';
  const ownerName = shopInfo?.owner_name || 'أ/ طه رجب';
  const shopAddress = shopInfo?.address || 'شارع الصاغة، سمالوط، المنيا';
  const commRecord = shopInfo?.commercial_record || '45892';
  const taxId = shopInfo?.tax_number || '100-245-889';
  const phones = shopInfo?.phone || '01141034439 - 01226398474';

  const isSale = invoice.invoice_type === 'sale';
  const invoiceDate = invoice.created_at ? new Date(invoice.created_at) : new Date();

  const formattedDate = invoiceDate.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const formattedTime = invoiceDate.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <div
      id="receipt-print-wrapper"
      className="receipt-print-container"
      style={{
        position: 'fixed',
        left: '-9999px',
        top: 0,
        zIndex: -100,
      }}
    >
      <style>{`
        @media print {
          #receipt-print-wrapper {
            position: static !important;
            left: auto !important;
            top: auto !important;
            z-index: auto !important;
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
          .no-print {
            display: none !important;
          }
          #half-a4-invoice-receipt {
            margin: 0 auto !important;
          }
        }
      `}</style>
      <div
        id="half-a4-invoice-receipt"
        className="w-[194mm] max-w-[194mm] mx-auto p-4 bg-white text-black font-sans text-xs border-2 border-black rounded-lg leading-tight box-border shadow-none"
        style={{ minHeight: '135mm', maxHeight: '142mm' }}
        dir="rtl"
      >
        {/* Top Header with Classic Egyptian Gold Shop Branding */}
        <div className="border-b-2 border-black pb-2 mb-2">
          <div className="flex items-center justify-between">
            {/* Right: Commercial Record & Tax */}
            <div className="text-[10px] space-y-0.5 text-right w-1/4">
              <p className="font-bold">س.ت: <span className="font-mono">{commRecord}</span></p>
              <p className="font-bold">ب.ض: <span className="font-mono">{taxId}</span></p>
              <p className="text-[9px] text-gray-700 font-mono mt-1">ت: {phones}</p>
            </div>

            {/* Center: Main Shop Brand */}
            <div className="text-center flex-1">
              <h1 className="text-xl font-black tracking-wide text-black mb-0.5">{shopName}</h1>
              <p className="text-xs font-bold text-gray-800">لتجارة وصياغة الذهب والمجوهرات والسبائك</p>
              <p className="text-[11px] font-bold text-gray-900 mt-0.5">إدارة: {ownerName}</p>
              <p className="text-[10px] text-gray-600">{shopAddress}</p>
            </div>

            {/* Left: Invoice Badge & Date */}
            <div className="text-left text-[10px] space-y-0.5 w-1/4">
              <div className="bg-gray-100 border border-black px-2 py-0.5 rounded text-center inline-block">
                <span className="font-bold block text-[9px]">رقم الفاتورة</span>
                <span className="font-mono font-black text-xs">{invoice.invoice_number}</span>
              </div>
              <p className="font-mono text-[10px] mt-1 text-left" dir="ltr">{formattedDate}</p>
              <p className="font-mono text-[9px] text-gray-600 text-left" dir="ltr">{formattedTime}</p>
            </div>
          </div>

          {/* Title Banner */}
          <div className="mt-2 text-center bg-gray-100 border-y border-black py-1">
            <span className="text-xs font-black tracking-wider">
              {isSale ? 'فاتورة بيع مصوغات ومجوهرات معتمدة' : 'فاتورة شراء ذهب كسر ومستعمل'}
            </span>
          </div>
        </div>

        {/* Customer Data Strip */}
        <div className="grid grid-cols-3 gap-2 bg-gray-50 border border-black p-1.5 rounded mb-2 text-[10px]">
          <div>
            <span className="font-bold text-gray-700">العميل / السيد: </span>
            <span className="font-bold text-black">{invoice.customer_name || 'عميل نقدي'}</span>
          </div>
          <div>
            <span className="font-bold text-gray-700">تليفون العميل: </span>
            <span className="font-mono font-bold text-black">{invoice.customer_phone || '—'}</span>
          </div>
          <div>
            <span className="font-bold text-gray-700">الرقم القومي: </span>
            <span className="font-mono font-bold text-black">{invoice.customer_national_id || '—'}</span>
          </div>
        </div>

        {/* Items Table with Grams and Milligrams (دفتر الصاغة المصري) */}
        <div className="border border-black rounded overflow-hidden mb-2">
          <table className="w-full text-center text-[10px] border-collapse">
            <thead>
              <tr className="bg-gray-200 border-b border-black font-bold text-gray-900">
                <th className="py-1 px-1 border-l border-black w-7">م</th>
                <th className="py-1 px-2 border-l border-black text-right">بيان الصنف والمصوغات</th>
                <th className="py-1 px-1 border-l border-black w-12">العيار</th>
                <th className="py-1 px-1 border-l border-black w-14">جرام</th>
                <th className="py-1 px-1 border-l border-black w-12">مللي</th>
                <th className="py-1 px-1 border-l border-black w-16">سعر الجرام</th>
                <th className="py-1 px-1 border-l border-black w-16">مصنعية/دمغة</th>
                <th className="py-1 px-2 text-left w-24">الإجمالي (ج.م)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300 font-mono text-[10px]">
              {invoice.items.map((item, idx) => {
                const net = item.net_weight || 0;
                const grams = Math.floor(net);
                const millis = Math.round((net - grams) * 1000);
                const work = (item.workmanship_per_gram || 0) + (item.stamp_vat_per_gram || 0);

                return (
                  <tr key={item.id || idx} className="hover:bg-gray-50">
                    <td className="py-1 px-1 border-l border-black font-sans font-bold">{idx + 1}</td>
                    <td className="py-1 px-2 border-l border-black text-right font-sans font-medium text-black">
                      {item.item_name}
                      {item.brand ? ` (${item.brand})` : ''}
                    </td>
                    <td className="py-1 px-1 border-l border-black font-bold text-amber-900">{item.karat}k</td>
                    <td className="py-1 px-1 border-l border-black font-black text-black text-[11px]">{grams}</td>
                    <td className="py-1 px-1 border-l border-black text-gray-800">{millis > 0 ? String(millis).padStart(3, '0') : '000'}</td>
                    <td className="py-1 px-1 border-l border-black text-gray-900">{(item.price_per_gram || 0).toLocaleString()}</td>
                    <td className="py-1 px-1 border-l border-black text-gray-700">{work > 0 ? work.toLocaleString() : '—'}</td>
                    <td className="py-1 px-2 text-left font-black text-black">
                      {item.total_item_price.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals & Financial Settlement */}
        <div className="grid grid-cols-2 gap-2 bg-gray-50 border border-black p-2 rounded mb-2 text-[10px]">
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">إجمالي الوزن الصافي:</span>
              <span className="font-mono font-black text-black text-[11px]">{invoice.total_net_weight.toFixed(3)} جرام</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">المعادل لعيار 21:</span>
              <span className="font-mono font-bold text-amber-900">{invoice.equivalent_21k_weight.toFixed(3)} جرام</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between text-red-700 font-bold">
                <span>القديم المستبدل / الخصم:</span>
                <span className="font-mono">-{invoice.discount.toLocaleString()} ج.م</span>
              </div>
            )}
          </div>

          <div className="space-y-1 border-r border-gray-300 pr-2">
            <div className="flex justify-between font-bold text-xs border-b border-gray-300 pb-0.5">
              <span>الصافي المطلوب:</span>
              <span className="font-mono font-black text-black">{invoice.final_amount.toLocaleString()} ج.م</span>
            </div>
            <div className="flex justify-between text-emerald-800 font-bold">
              <span>المسدد نقدياً / تحويل:</span>
              <span className="font-mono">{(invoice.paid_amount ?? invoice.final_amount).toLocaleString()} ج.م</span>
            </div>
            {(invoice.remaining_amount || 0) > 0 && (
              <div className="flex justify-between text-red-700 font-black">
                <span>المتبقي على العميل:</span>
                <span className="font-mono">{(invoice.remaining_amount || 0).toLocaleString()} ج.م</span>
              </div>
            )}
          </div>
        </div>

        {/* Legal Terms of Egyptian Gold Standards */}
        <div className="text-[8px] text-gray-800 bg-white border border-gray-300 p-1 rounded space-y-0.5 leading-snug">
          <p>• المصوغات الموضحة أعلاه مدموغة بدمغة الحكومة المصرية الرسمية ومطابقة للمواصفات القانونية.</p>
          <p>• على العميل فحص ومراجعة الوزن خلال 3 أيام من الشراء لأن المصاغ يقل وزنه بالاستعمال.</p>
          <p>• المحل غير مسؤول عن أي مصوغات دون أصل هذه الفاتورة المعتمدة.</p>
        </div>

        {/* Signatures */}
        <div className="flex items-center justify-between text-[10px] font-bold pt-2 mt-1 border-t border-dashed border-black">
          <div>توقيع المشتري: .......................................</div>
          <div>توقيع وخاتم المحل ({ownerName}): .......................................</div>
        </div>
      </div>
    </div>
  );
};
