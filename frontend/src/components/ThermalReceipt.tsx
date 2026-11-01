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

  return (
    <div className="hidden print-only max-w-[80mm] mx-auto p-2 text-black text-xs font-sans leading-tight bg-white">
      {/* Header */}
      <div className="text-center border-b border-black pb-2 mb-2">
        <h1 className="text-lg font-bold">{shopName}</h1>
        <p className="text-[11px] font-bold">إدارة: {ownerName}</p>
        <p className="text-[10px]">لتجارة وصياغة الذهب والمجوهرات والسبائك</p>
        <p className="text-[10px]">{shopAddress}</p>
        <p className="text-[10px] font-mono font-bold mt-0.5" dir="ltr">ت: {phones}</p>
        <p className="text-[9px]">س.ت: {commRecord} | ب.ض: {taxId}</p>
        <p className="text-[10px] font-bold mt-1.5 bg-gray-100 py-1 border-y border-black">
          {invoice.invoice_type === 'sale' ? 'فاتورة بيع ذهب ومجوهرات معتمدة' : 'فاتورة شراء ذهب كسر ومستعمل'}
        </p>
      </div>

      {/* Invoice & Customer Meta */}
      <div className="text-[10px] space-y-1 border-b border-black pb-2 mb-2">
        <div className="flex justify-between">
          <span>رقم الفاتورة:</span>
          <span className="font-mono font-bold">{invoice.invoice_number}</span>
        </div>
        <div className="flex justify-between">
          <span>التاريخ:</span>
          <span className="font-mono">{new Date(invoice.created_at).toLocaleString('ar-EG')}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>اسم العميل:</span>
          <span>{invoice.customer_name || 'عميل نقدي'}</span>
        </div>
        {invoice.customer_phone && (
          <div className="flex justify-between">
            <span>تليفون العميل:</span>
            <span className="font-mono font-bold">{invoice.customer_phone}</span>
          </div>
        )}
        {invoice.customer_national_id && (
          <div className="flex justify-between">
            <span>الرقم القومي:</span>
            <span className="font-mono">{invoice.customer_national_id}</span>
          </div>
        )}
        {invoice.notes && (
          <div className="flex justify-between">
            <span>العنوان / ملاحظات:</span>
            <span>{invoice.notes}</span>
          </div>
        )}
      </div>

      {/* Items Table with Grams and Milligrams */}
      <table className="w-full text-right text-[10px] mb-2 border-b border-black pb-2">
        <thead>
          <tr className="border-b border-black text-center font-bold">
            <th className="py-1 text-right">الصنف</th>
            <th className="py-1">عيار</th>
            <th className="py-1">جرام</th>
            <th className="py-1">مللي</th>
            <th className="py-1 text-left">القيمة (ج.م)</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, idx) => {
            const grams = Math.floor(item.net_weight);
            const millis = Math.round((item.net_weight - grams) * 1000);
            return (
              <tr key={idx} className="border-b border-gray-200 text-center">
                <td className="py-1 text-right font-medium">{item.item_name}</td>
                <td className="py-1 font-mono">{item.karat || 21}</td>
                <td className="py-1 font-mono font-bold">{grams}</td>
                <td className="py-1 font-mono">{millis > 0 ? millis : '-'}</td>
                <td className="py-1 font-mono font-bold text-left">{item.total_item_price.toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals & Net Settlement */}
      <div className="text-[11px] space-y-1 border-b border-black pb-2 mb-2">
        <div className="flex justify-between">
          <span>إجمالي الوزن الصافي:</span>
          <span className="font-mono font-bold">{invoice.total_net_weight.toFixed(3)} جرام</span>
        </div>
        {invoice.invoice_type === 'sale' && invoice.total_workmanship > 0 && (
          <div className="flex justify-between text-[10px]">
            <span>إجمالي المصنعية والدمغة:</span>
            <span className="font-mono">{(invoice.total_workmanship + invoice.total_stamp_vat).toLocaleString()} ج.م</span>
          </div>
        )}
        {invoice.discount > 0 && (
          <div className="flex justify-between text-[10px]">
            <span>القديم المستبدل / الخصم:</span>
            <span className="font-mono font-bold text-red-600">-{invoice.discount.toLocaleString()} ج.م</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-black">
          <span>الصافي المطلوب (الفرق):</span>
          <span className="font-mono">{invoice.final_amount.toLocaleString()} ج.م</span>
        </div>
        {(invoice.remaining_amount || 0) > 0 && (
          <>
            <div className="flex justify-between text-[10px]">
              <span>المسدد كاش/تحويل:</span>
              <span className="font-mono">{(invoice.paid_amount ?? invoice.final_amount).toLocaleString()} ج.م</span>
            </div>
            <div className="flex justify-between text-[10px] font-bold text-red-600">
              <span>المتبقي على العميل:</span>
              <span className="font-mono">{(invoice.remaining_amount || 0).toLocaleString()} ج.م</span>
            </div>
          </>
        )}
        <div className="flex justify-between text-[10px] pt-1">
          <span>البائع المسؤول:</span>
          <span className="font-bold">{ownerName}</span>
        </div>
      </div>

      {/* Legal Egyptian Gold Terms from Booklet */}
      <div className="text-[8px] text-right space-y-1 leading-tight text-gray-700 bg-gray-50 p-1.5 rounded border border-gray-300">
        <p>• المصوغات الموضحة أعلاه مدموغة بدمغة الحكومة المصرية الرسمية.</p>
        <p>• على العميل مراجعة الوزن خلال ثلاثة أيام لأن المصاغ يقل وزنه بالاستعمال.</p>
        <p>• حسب القانون رقم 68 لسنة 1976 بند 2 يقع رسم الدمغة على طالب الفاتورة.</p>
        <p>• المحل غير مسؤول عن أي مصوغات بدون أصل هذه الفاتورة المعتمدة.</p>
      </div>

      {/* Signatures */}
      <div className="flex justify-between text-[9px] pt-3 mt-2 border-t border-dashed border-black">
        <span>توقيع العميل: ...................</span>
        <span>توقيع المحل (أ/ طه رجب): ...................</span>
      </div>
    </div>
  );
};
