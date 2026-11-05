import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { Invoice, ShopInfo } from '../types';

/**
 * Generates a high-resolution PDF Blob from a rendered DOM element
 */
export async function generateInvoicePDFBlob(elementId: string): Promise<Blob | null> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found.`);
    return null;
  }

  // Ensure element is visible during capture
  const originalDisplay = element.style.display;
  const originalVisibility = element.style.visibility;
  element.style.display = 'block';
  element.style.visibility = 'visible';

  try {
    const canvas = await html2canvas(element, {
      scale: 2.5, // Crisp high-DPI rendering for text and borders
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

    // Place at the top of A4 (Half A4 size: ~135mm - 142mm)
    pdf.addImage(imgData, 'JPEG', margin, margin, pdfWidth, pdfHeight);

    return pdf.output('blob');
  } catch (err) {
    console.error('Error generating PDF:', err);
    return null;
  } finally {
    element.style.display = originalDisplay;
    element.style.visibility = originalVisibility;
  }
}

/**
 * Downloads the Half-A4 invoice PDF directly
 */
export async function downloadInvoicePDF(elementId: string, invoiceNumber: string): Promise<boolean> {
  const blob = await generateInvoicePDFBlob(elementId);
  if (!blob) return false;

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

/**
 * Sends/Shares the Invoice via WhatsApp as a PDF file
 */
export async function shareInvoiceViaWhatsApp(
  elementId: string,
  invoice: Invoice,
  shopInfo?: ShopInfo | null
): Promise<void> {
  const shopName = shopInfo?.name || 'مجوهرات الهدى';
  const blob = await generateInvoicePDFBlob(elementId);
  if (!blob) {
    alert('حدث خطأ أثناء إنشاء ملف الـ PDF');
    return;
  }

  const filename = `فاتورة-${invoice.invoice_number}.pdf`;
  const pdfFile = new File([blob], filename, { type: 'application/pdf' });

  // 1. Mobile & Web Share API support (directly opens WhatsApp with file attached)
  const nav = navigator as any;
  if (nav.canShare && nav.canShare({ files: [pdfFile] })) {
    try {
      await nav.share({
        files: [pdfFile],
        title: `فاتورة ${shopName}`,
        text: `مرحباً ${invoice.customer_name}، إليك فاتورتك الرسمية المعتمدة رقم ${invoice.invoice_number} من ${shopName}.`,
      });
      return;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Web Share failed, falling back to download:', err);
      } else {
        return; // user cancelled share
      }
    }
  }

  // 2. Desktop Fallback:
  // Auto-download the PDF so the user has it ready
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  // Open WhatsApp chat directly with summary
  const rawPhone = (invoice.customer_phone || '').replace(/\D/g, '');
  if (!rawPhone) {
    alert('تم تحميل الفاتورة بصيغة PDF بنجاح! لم يُسجل رقم هاتف للعميل لفتح واتساب.');
    return;
  }

  const phoneWithCountry = rawPhone.startsWith('0') ? `2${rawPhone}` : rawPhone;
  const textMsg = `مرحباً ${invoice.customer_name}،
شكراً لتعاملك مع ${shopName}.
فاتورتك رقم: ${invoice.invoice_number}
نوع الفاتورة: ${invoice.invoice_type === 'sale' ? 'فاتورة بيع ذهب ومجوهرات' : 'فاتورة شراء كسر'}
إجمالي الوزن الصافي: ${invoice.total_net_weight.toFixed(3)} جرام
المبلغ الإجمالي: ${invoice.final_amount.toLocaleString()} ج.م
المسدد: ${(invoice.paid_amount ?? invoice.final_amount).toLocaleString()} ج.م${(invoice.remaining_amount || 0) > 0 ? `\nالمتبقي: ${(invoice.remaining_amount || 0).toLocaleString()} ج.م` : ''}

📄 تم حفظ نسخة الفاتورة الرسمية (PDF) على جهازك للإرسال في المحادثة.`;

  window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(textMsg)}`, '_blank');
}
