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
 * Sends the invoice text directly via WhatsApp cleanly and reliably without black screens or popup blockers
 */
export function sendInvoiceViaWhatsApp(
  invoice: Invoice,
  shopInfo?: ShopInfo | null,
  preOpenedWindow?: Window | null
): void {
  const text = buildWhatsAppInvoiceText(invoice, shopInfo);

  // Copy to clipboard silently as a 100% reliable backup
  try {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  } catch {}

  let rawPhone = (invoice.customer_phone || '').replace(/\D/g, '');

  // Format Egyptian and international numbers
  let formattedPhone = rawPhone;
  if (formattedPhone.startsWith('002')) {
    formattedPhone = formattedPhone.substring(2);
  } else if (formattedPhone.startsWith('0')) {
    formattedPhone = `2${formattedPhone}`;
  } else if (formattedPhone.length === 10 && !formattedPhone.startsWith('2')) {
    formattedPhone = `20${formattedPhone}`;
  }

  const encoded = encodeURIComponent(text);
  const waUrl = formattedPhone
    ? `https://wa.me/${formattedPhone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    if (preOpenedWindow) {
      try { preOpenedWindow.close(); } catch {}
    }
    // On mobile, direct window.location.href always launches WhatsApp app smoothly
    window.location.href = waUrl;
  } else {
    // On desktop
    if (preOpenedWindow && !preOpenedWindow.closed) {
      preOpenedWindow.location.href = waUrl;
      preOpenedWindow.focus();
    } else {
      const win = window.open(waUrl, '_blank');
      if (!win) {
        window.location.href = waUrl;
      }
    }
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

  const wrapper = document.getElementById('receipt-print-wrapper');
  const prevDisplay = wrapper ? wrapper.style.display : '';
  const prevPosition = wrapper ? wrapper.style.position : '';
  const prevLeft = wrapper ? wrapper.style.left : '';
  const prevTop = wrapper ? wrapper.style.top : '';
  const prevZIndex = wrapper ? wrapper.style.zIndex : '';
  const prevOpacity = wrapper ? wrapper.style.opacity : '';
  const prevVisibility = wrapper ? wrapper.style.visibility : '';

  try {
    // Temporarily bring wrapper into visible viewport for html2canvas to capture real pixels
    if (wrapper) {
      wrapper.style.display = 'block';
      wrapper.style.position = 'fixed';
      wrapper.style.left = '0';
      wrapper.style.top = '0';
      wrapper.style.zIndex = '99999';
      wrapper.style.opacity = '1';
      wrapper.style.visibility = 'visible';
    }

    // Wait 100ms for browser to repaint the table and fonts
    await new Promise((resolve) => setTimeout(resolve, 100));

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1000,
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
    pdf.addImage(imgData, 'JPEG', margin, margin, pdfWidth, Math.min(pdfHeight, 140));

    return pdf.output('blob');
  } catch (err) {
    console.error('Error generating PDF:', err);
    return null;
  } finally {
    // Restore wrapper back to hidden print-only state
    if (wrapper) {
      wrapper.style.display = prevDisplay;
      wrapper.style.position = prevPosition;
      wrapper.style.left = prevLeft;
      wrapper.style.top = prevTop;
      wrapper.style.zIndex = prevZIndex;
      wrapper.style.opacity = prevOpacity;
      wrapper.style.visibility = prevVisibility;
    }
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
