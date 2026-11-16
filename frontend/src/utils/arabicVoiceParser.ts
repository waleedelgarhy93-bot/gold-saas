// Utility for parsing and normalizing Egyptian Arabic speech for specific POS fields

export type FieldVoiceType = 'name' | 'national_id' | 'phone' | 'item' | 'weight' | 'money' | 'text';

// Convert eastern Arabic numerals (٠-٩) to standard (0-9)
export function normalizeArabicDigits(str: string): string {
  if (!str) return '';
  return str.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

function replaceArabicWords(str: string, wordMap: Record<string, string>): string {
  let res = str;
  for (const [w, repl] of Object.entries(wordMap)) {
    const reg = new RegExp('(^|\\s+)' + w + '(?=$|\\s+)', 'g');
    res = res.replace(reg, '$1' + repl + ' ');
  }
  return res;
}

const numberWords: Record<string, string> = {
  'صفر': '0', 'زيرو': '0',
  'واحد': '1', 'واحدة': '1',
  'اتنين': '2', 'اثنين': '2', 'تنين': '2',
  'تلاتة': '3', 'تلاته': '3', 'ثلاثة': '3', 'ثلاثه': '3',
  'اربعة': '4', 'أربعة': '4', 'اربعه': '4', 'أربعه': '4',
  'خمسة': '5', 'خمسه': '5',
  'ستة': '6', 'سته': '6',
  'سبعة': '7', 'سبعه': '7',
  'تمانية': '8', 'ثمانية': '8', 'تمانيه': '8', 'ثمانيه': '8',
  'تسعة': '9', 'تسعه': '9',
  'عشرة': '10', 'عشره': '10',
  'حداشر': '11', 'أحد عشر': '11',
  'اتناشر': '12', 'اثنا عشر': '12',
  'عشرين': '20', 'عشرون': '20',
  'تلاتين': '30', 'ثلاثين': '30',
  'اربعين': '40', 'أربعين': '40',
  'خمسين': '50',
  'ستين': '60',
  'سبعين': '70',
  'تمانين': '80', 'ثمانين': '80',
  'تسعين': '90',
  'مية': '100', 'ميه': '100', 'مائة': '100', 'مئة': '100',
  'ميتين': '200', 'مائتين': '200'
};

export function cleanSpokenName(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^(?:اسم\s*العميل|اسم\s*الزبون|العميل|الزبون|المشتري|باسم)\s*/i, '');
  s = s.replace(/^(?:هو|هي|ده|دة)\s*/i, '');
  return s.trim();
}

export function cleanSpokenItem(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^(?:اسم\s*الصنف|الصنف|اسم\s*القطعة|القطعة|نوع\s*القطعة|هبيع|هنبيع|بيع|أبيع|اشتر|هشتري)\s*/i, '');
  s = s.replace(/^(?:هو|هي|ده|دة)\s*/i, '');
  return s.trim();
}

export function parseSpokenPhone(raw: string): string {
  let s = normalizeArabicDigits(raw).toLowerCase().trim();
  s = s.replace(/^(?:رقم\s*الموبايل|رقم\s*التليفون|الموبايل|التليفون|تليفونه|موبايله|رقم|تليفون|موبايل|هاتف|تلفون)\s*/i, '');

  const singleDigits: Record<string, string> = {
    'زيرو': '0', 'صفر': '0', 'واحد': '1', 'اتنين': '2', 'اثنين': '2',
    'تلاتة': '3', 'تلاته': '3', 'ثلاثة': '3', 'ثلاثه': '3',
    'اربعة': '4', 'أربعة': '4', 'اربعه': '4', 'أربعه': '4',
    'خمسة': '5', 'خمسه': '5', 'ستة': '6', 'سته': '6',
    'سبعة': '7', 'سبعه': '7', 'تمانية': '8', 'ثمانية': '8',
    'تسعة': '9', 'تسعه': '9', 'عشرة': '10', 'عشره': '10'
  };

  s = replaceArabicWords(s, singleDigits);
  const digitsOnly = s.replace(/[^0-9]/g, '');

  const match = digitsOnly.match(/01[0125][0-9]{8}/);
  if (match) return match[0];
  if (/^1[0125][0-9]{8}$/.test(digitsOnly)) return '0' + digitsOnly;
  return digitsOnly.slice(0, 11);
}

export function parseSpokenNationalId(raw: string): string {
  let s = normalizeArabicDigits(raw).toLowerCase().trim();
  s = s.replace(/^(?:الرقم\s*القومي|رقم\s*البطاقة|الرقم|البطاقة|بطاقة)\s*/i, '');

  const singleDigits: Record<string, string> = {
    'زيرو': '0', 'صفر': '0', 'واحد': '1', 'اتنين': '2', 'اثنين': '2',
    'تلاتة': '3', 'تلاته': '3', 'ثلاثة': '3', 'ثلاثه': '3',
    'اربعة': '4', 'أربعة': '4', 'اربعه': '4', 'أربعه': '4',
    'خمسة': '5', 'خمسه': '5', 'ستة': '6', 'سته': '6',
    'سبعة': '7', 'سبعه': '7', 'تمانية': '8', 'ثمانية': '8',
    'تسعة': '9', 'تسعه': '9', 'عشرة': '10', 'عشره': '10'
  };

  s = replaceArabicWords(s, singleDigits);
  const digitsOnly = s.replace(/[^0-9]/g, '');

  const match = digitsOnly.match(/[23][0-9]{13}/);
  if (match) return match[0];
  return digitsOnly.slice(0, 14);
}

export function parseSpokenWeight(raw: string): string {
  let s = normalizeArabicDigits(raw).toLowerCase().trim();
  s = s.replace(/^(?:الوزن\s*القائم|الوزن|وزنه|وزنها|وزن)\s*/i, '');

  // Extract common Egyptian fractions
  let frac = 0;
  if (/تلات تربع|ثلاثة أرباع/.test(s)) {
    frac = 0.75;
    s = s.replace(/و?\s*(تلات تربع|ثلاثة أرباع)/g, '');
  } else if (/نص|نصف/.test(s)) {
    frac = 0.5;
    s = s.replace(/و?\s*(نص|نصف)/g, '');
  } else if (/ربع/.test(s)) {
    frac = 0.25;
    s = s.replace(/و?\s*ربع/g, '');
  } else if (/تلت|ثلث/.test(s)) {
    frac = 0.33;
    s = s.replace(/و?\s*(تلت|ثلث)/g, '');
  }

  s = s.replace(/(?:جرام|جم)/g, '').trim();

  // If only spoken fraction e.g. "نص جرام" -> 0.5
  if (frac > 0 && (!s || s === 'و')) {
    return String(frac);
  }

  // Replace words with numbers
  s = replaceArabicWords(s, numberWords);

  // Replace decimal words like فاصلة or بوينت
  s = s.replace(/\s*(?:فاصلة|فاصله|بوينت|نقطة|كومة|\,)\s*/g, '.');
  s = s.replace(/\s*\.\s*/g, '.');

  const match = s.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (match) {
    const val = parseFloat(match[1]) + frac;
    return String(parseFloat(val.toFixed(3)));
  }

  return frac ? String(frac) : s.replace(/[^0-9.]/g, '');
}

export function parseSpokenMoney(raw: string): string {
  let s = normalizeArabicDigits(raw).toLowerCase().trim();
  s = s.replace(/^(?:المصنعية|مصنعية|السعر|سعر\s*الجرام|سعر|الدمغة|دمغة|قيمة\s*مضافة|ضريبة)\s*/i, '');
  s = s.replace(/(?:جنيه|ج\.م|ج)/g, '').trim();

  // Replace words
  s = replaceArabicWords(s, numberWords);
  s = s.replace(/\s*(?:فاصلة|فاصله|بوينت|نقطة|كومة|\,)\s*/g, '.');
  s = s.replace(/\s*\.\s*/g, '.');

  const match = s.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (match) {
    return match[1];
  }

  return s.replace(/[^0-9.]/g, '');
}

export function formatSpokenForField(raw: string, fieldType: FieldVoiceType): string {
  if (!raw) return '';
  switch (fieldType) {
    case 'name':
      return cleanSpokenName(raw);
    case 'item':
      return cleanSpokenItem(raw);
    case 'phone':
      return parseSpokenPhone(raw);
    case 'national_id':
      return parseSpokenNationalId(raw);
    case 'weight':
      return parseSpokenWeight(raw);
    case 'money':
      return parseSpokenMoney(raw);
    case 'text':
    default:
      return raw.trim();
  }
}
