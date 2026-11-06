import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { Invoice, ShopInfo } from '../types';

/**
 * Builds a beautifully formatted, official Arabic WhatsApp text receipt
 */
export function buildWhatsAppInvoiceText(invoice: Invoice, shopInfo?: ShopInfo | null): string {
  const shopName = shopInfo?.name || 'محل الذهب والمجوهرات';
  const ownerName = shopInfo?.owner_name || '';
  const phones = shopInfo?.phone || '';
  const isSale = invoice.invoice_type === 'sale';

  const d = invoice.created_at ? new Date(invoice.created_at) : new Date();
  const dateStr = d.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeStr = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });

  let text = `👑 *${shopName}* 👑\n`;
  if (ownerName) text += `بإدارة: ${ownerName}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📄 *فاتورة ${isSale ? 'بيع مصوغات' : 'شراء كسر'} رسمية معتمدة*\n`;
  text += `🔢 *رقم الفاتورة:* ${invoice.invoice_number}\n`;
  text += `📅 *التاريخ:* ${dateStr} - ${timeStr}\n`;
  text += `👤 *العميل:* ${invoice.customer_name || 'عميل نقدي'}\n`;
  if (invoice.customer_national_id) {
    text += `🆔 *الرقم القومي:* ${invoice.customer_national_id}\n`;
  }
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📋 *بيان المصوغات والأصناف:*\n`;

  (invoice.items || []).forEach((item, idx) => {
    const net = item.net_weight || 0;
    text += `${idx + 1}️⃣ *${item.item_name}* (عيار ${item.karat}k)\n`;
    text += `   ⚖️ الوزن: ${net.toFixed(2)} جرام`;
    if (item.total_item_price) {
      text += ` | 💰 ${item.total_item_price.toLocaleString()} ج.م`;
    }
    text += `\n`;
  });

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `⚖️ *إجمالي الوزن الصافي:* ${invoice.total_net_weight.toFixed(2)} جرام\n`;
  text += `✨ *المعادل عيار 21:* ${invoice.equivalent_21k_weight.toFixed(2)} جرام\n`;
  if (invoice.discount && invoice.discount > 0) {
    text += `🔻 *الخصم / القديم المستبدل:* -${invoice.discount.toLocaleString()} ج.م\n`;
  }
  text += `💰 *الإجمالي الصافي:* ${invoice.final_amount.toLocaleString()} ج.م\n`;
  text += `💵 *المسدد:* ${(invoice.paid_amount ?? invoice.final_amount).toLocaleString()} ج.م\n`;

  if ((invoice.remaining_amount || 0) > 0) {
    text += `⚠️ *المتبقي على العميل:* ${(invoice.remaining_amount || 0).toLocaleString()} ج.م\n`;
  } else {
    text += `✅ *حالة السداد:* مسدد بالكامل\n`;
  }

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📜 *ملاحظة:* جميع المصوغات مدموغة ومطابقة للمواصفات القانونية المصرية.\n`;
  if (phones) text += `📞 *تليفون المحل:* ${phones}\n`;
  text += `🙏 *يسعدنا دائماً خدمتكم وتشريفكم لنا.*`;

  return text;
}

/**
 * Sends the invoice text directly via WhatsApp cleanly and reliably without black screens
 */
export function sendInvoiceViaWhatsApp(invoice: Invoice, shopInfo?: ShopInfo | null): void {
  const text = buildWhatsAppInvoiceText(invoice, shopInfo);
  
  // Clean and format phone number for Egyptian and international formats
  let rawPhone = (invoice.customer_phone || '').replace(/\D/g, '');
  if (rawPhone.startsWith('002')) {
    rawPhone = rawPhone.substring(2);
  } else if (rawPhone.startsWith('0')) {
    rawPhone = `2${rawPhone}`;
  } else if (rawPhone.length === 10 && !rawPhone.startsWith('2')) {
    rawPhone = `20${rawPhone}`;
  }

  const encoded = encodeURIComponent(text);
  
  // Standard universal wa.me URL
  const url = rawPhone
    ? `https://wa.me/${rawPhone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;

  // Direct trigger using a temporary anchor to prevent popup blockers
  try {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 500);
  } catch (err) {
    console.warn('Fallback opening WhatsApp:', err);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Generates a high-resolution PDF Blob from a rendered DOM element
 */
export async function generateInvoicePDFBlob(elementId: string): Promise<Blob | null> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found.`);
    return null;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1000,
      onclone: (clonedDoc) => {
        const wrapper = clonedDoc.getElementById('receipt-print-wrapper');
        if (wrapper) {
          wrapper.style.position = 'static';
          wrapper.style.left = '0';
          wrapper.style.visibility = 'visible';
          wrapper.style.display = 'block';
        }
        const el = clonedDoc.getElementById(elementId);
        if (el) {
          el.style.position = 'static';
          el.style.left = '0';
          el.style.visibility = 'visible';
          el.style.display = 'block';
        }
      },
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);

    // A4 Portrait: 210mm x 297mm
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const margin = 6;
    const pdfWidth = 210 - (margin * 2); // 198mm
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    // Place at top half of A4
    pdf.addImage(imgData, 'JPEG', margin, margin, pdfWidth, pdfHeight);

    return pdf.output('blob');
  } catch (err) {
    console.error('Error generating PDF:', err);
    return null;
  }
}

/**
 * Downloads the Half-A4 invoice PDF directly
 */
export async function downloadInvoicePDF(elementId: string, invoiceNumber: string): Promise<boolean> {
  const blob = await generateInvoicePDFBlob(elementId);
  if (!blob) {
    alert('تعذر إنشاء ملف الـ PDF. يمكنك استخدام زر الطباعة (نصف A4) أو إرسال الفاتورة عبر واتساب.');
    return false;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `فاتورة-${invoiceNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}
