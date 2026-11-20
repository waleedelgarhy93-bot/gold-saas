// تحويل أي رقم مكتوب من كيبورد عربي/فارسي لصيغة يفهمها الحساب.
// أمثلة: "١٢٫٥" -> "12.5" ، "12,5" -> "12.5" ، "۱۲" -> "12"
// خانات type="number" كانت بتمسح القيمة دي بصمت فالوزن بيبقى صفر.
export function normalizeNumber(raw: string): string {
  if (raw == null) return '';
  let s = String(raw)
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // Arabic-Indic
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)) // Persian
    .replace(/[٫,،]/g, '.')
    .replace(/[^0-9.\-]/g, '');
  // نسيب علامة سالب واحدة في الأول بس
  const negative = s.startsWith('-');
  s = s.replace(/-/g, '');
  // نسيب علامة عشرية واحدة بس
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  }
  return (negative ? '-' : '') + s;
}
