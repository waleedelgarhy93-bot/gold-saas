import React from 'react';
import type { Invoice, ShopInfo } from '../types';

interface ThermalReceiptProps {
  invoice: Invoice | null;
  shopInfo?: ShopInfo | null;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ invoice, shopInfo }) => {
  if (!invoice) return null;

  const shopName = shopInfo?.name || 'مجوهرات الأمانة الذهبية';
  const shopAddress = shopInfo?.address || 'المنيا - جمهورية مصر العربية';
  const commRecord = shopInfo?.commercial_record || '45892';
  const taxId = shopInfo?.tax_number || '100-245-889';
  const phone = shopInfo?.phone || '01012345678';

  return (
    <div className="hidden print-only max-w-[80mm] mx-auto p-2 text-black text-xs font-sans leading-tight bg-white">
      {/* Header */}
      <div className="text-center border-b border-black pb-2 mb-2">
        <h1 className="text-base font-bold">{shopName}</h1>
        <p className="text-[10px]">لتجارة الذهب والمجوهرات والسبائك</p>
        <p className="text-[10px]">{shopAddress}</p>
        <p className="text-[9px]">س.ت: {commRecord} | ب.ض: {taxId}</p>
        <p className="text-[9px]">تليفون: {phone}</p>
        <p className="text-[10px] font-bold mt-1 bg-gray-100 py-0.5 border-y border-black">
          {invoice.invoice_type === 'sale' ? 'فاتورة بيع ذهب وضمان معتمد' : 'فاتورة شراء كسر من عميل'}
        </p>
      </div>

      {/* Invoice Meta */}
      <div className="text-[10px] space-y-0.5 border-b border-black pb-2 mb-2">
        <div className="flex justify-between">
          <span>رقم الفاتورة:</span>
          <span className="font-mono font-bold">{invoice.invoice_number}</span>
        </div>
        <div className="flex justify-between">
          <span>التاريخ:</span>
          <span className="font-mono">{new Date(invoice.created_at).toLocaleString('ar-EG')}</span>
        </div>
        <div className="flex justify-between">
          <span>العميل:</span>
          <span className="font-bold">{invoice.customer_name}</span>
        </div>
        {invoice.customer_national_id && (
          <div className="flex justify-between">
            <span>الرقم القومي:</span>
            <span className="font-mono">{invoice.customer_national_id}</span>
          </div>
        )}
      </div>

      {/* Items */}
      <table className="w-full text-right text-[10px] mb-2 border-b border-black pb-2">
        <thead>
          <tr className="border-b border-black">
            <th className="py-1">الصنف</th>
            <th className="py-1">العيار</th>
            <th className="py-1">الوزن</th>
            <th className="py-1">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, idx) => (
            <tr key={idx} className="border-b border-gray-300">
              <td className="py-1">{item.item_name}</td>
              <td className="py-1">{item.karat || 21}</td>
              <td className="py-1 font-mono">{item.net_weight.toFixed(2)}g</td>
              <td className="py-1 font-mono font-bold">{item.total_item_price.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
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
            <span>الخصم:</span>
            <span className="font-mono">-{invoice.discount} ج.م</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold pt-1 border-t border-black">
          <span>المبلغ الإجمالي:</span>
          <span className="font-mono">{invoice.final_amount.toLocaleString()} ج.م</span>
        </div>
        {(invoice.remaining_amount || 0) > 0 && (
          <>
            <div className="flex justify-between text-[10px]">
              <span>المسدد:</span>
              <span className="font-mono">{(invoice.paid_amount ?? invoice.final_amount).toLocaleString()} ج.م</span>
            </div>
            <div className="flex justify-between text-[10px] font-bold">
              <span>الباقي:</span>
              <span className="font-mono">{(invoice.remaining_amount || 0).toLocaleString()} ج.م</span>
            </div>
          </>
        )}
      </div>

      {/* Legal & Policy Note */}
      <div className="text-[8px] text-center space-y-1">
        <p>الذهب المبيع مضمون العيار والوزن طبقاً لدمغة مصلحة الدمغة والموازين المصرية.</p>
        <p>شكراً لثقتكم الغالية - {shopName}</p>
      </div>

      {/* Signatures */}
      <div className="flex justify-between text-[9px] pt-4 mt-2 border-t border-dashed border-black">
        <span>توقيع العميل: ...................</span>
        <span>توقيع المحل: ...................</span>
      </div>
    </div>
  );
};
