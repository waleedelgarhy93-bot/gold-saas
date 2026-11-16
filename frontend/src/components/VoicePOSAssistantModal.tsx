import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Sparkles, CheckCircle2, AlertCircle, X } from 'lucide-react';
import type { GoldPrices } from '../types';

export interface VoiceExtractedData {
  invoice_type: 'sale' | 'buyback';
  customer_name?: string;
  customer_phone?: string;
  customer_national_id?: string;
  item_name?: string;
  karat: number;
  gross_weight: number;
  stones_weight: number;
  workmanship_per_gram: number;
  notes?: string;
}

interface VoicePOSAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyData: (data: VoiceExtractedData) => void;
  currentPrices?: GoldPrices;
}

// Convert eastern Arabic numerals (٠-٩) to standard (0-9)
function normalizeArabicDigits(str: string): string {
  return str.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

// Intelligent extractor for Egyptian Gold Shop speech patterns
export function parseEgyptianGoldSpeech(rawText: string): VoiceExtractedData {
  const text = normalizeArabicDigits(rawText.trim());

  // 1. Transaction Type
  let invoice_type: 'sale' | 'buyback' = 'sale';
  if (/شراء|كسر|نشتري|نشترى|هنشتري|مرتجع/i.test(text)) {
    invoice_type = 'buyback';
  } else if (/بيع|نبيع|أبيع|هنبيع/i.test(text)) {
    invoice_type = 'sale';
  }

  // 2. Phone Number (Egyptian 11 digits: 010, 011, 012, 015)
  let customer_phone: string | undefined = undefined;
  const phoneMatch = text.match(/(?:01[0125][0-9]{8})/);
  if (phoneMatch) {
    customer_phone = phoneMatch[0];
  } else {
    // Check spaced digits e.g. 010 1234 5678
    const spacedPhone = text.match(/01[0125][\s0-9]{8,14}/);
    if (spacedPhone) {
      const clean = spacedPhone[0].replace(/\s+/g, '');
      if (clean.length === 11) customer_phone = clean;
    }
  }

  // 3. National ID (14 digits)
  let customer_national_id: string | undefined = undefined;
  const natIdMatch = text.match(/\b[23][0-9]{13}\b/);
  if (natIdMatch) {
    customer_national_id = natIdMatch[0];
  }

  // 4. Customer Name
  let customer_name = 'عميل نقدي';
  const namePatterns = [
    /(?:للأستاذ|للاستاذ|للأستاذة|للاستاذة|للمهندس|للدكتور|للحاج|للحاجة|للمدام|للعميل|للسيد|للعميلة|باسم|اسم العميل|اسمه|اسمها)\s+([^\d,\.\n]+?)(?=\s+(?:رقم|تليفون|موبايل|هاتف|خاتم|دبلة|سلسلة|غويشة|غوايش|حلق|انسيال|سبيكة|جنيه|عيار|وزن|$))/i,
    /(?:بيع ل|شراء من)\s+([^\d,\.\n]+?)(?=\s+(?:رقم|تليفون|موبايل|هاتف|خاتم|دبلة|سلسلة|غويشة|حلق|انسيال|سبيكة|$))/i,
  ];

  for (const pat of namePatterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      const cleaned = match[1].replace(/(?:أستاذ|استاذ|حاج|مدام|دكتور|مهندس)/g, '').trim();
      if (cleaned.length >= 2) {
        customer_name = cleaned;
        break;
      }
    }
  }

  // 5. Item Name
  let item_name = invoice_type === 'sale' ? 'غويشة عيار 21' : 'كسر ذهب عيار 21';
  const itemKeywords = [
    'خاتم', 'دبلة', 'غويشة', 'غوايش', 'سلسلة', 'سلاسل', 'كوليه', 'حلق', 'حلقان',
    'انسيال', 'اسورة', 'سوار', 'سبيكة', 'سبائك', 'جنيه', 'نصف جنيه', 'ربع جنيه',
    'توينز', 'محبس', 'تعليقة', 'مدالية', 'كف', 'عقد', 'مصحف ذهب'
  ];

  for (const kw of itemKeywords) {
    if (text.includes(kw)) {
      // Check if brand mentioned
      let brand = '';
      if (/لازوردي/i.test(text)) brand = ' لازوردي';
      else if (/btc|بي تي سي/i.test(text)) brand = ' BTC';
      else if (/إيجيبت جولد|ايجيبت جولد/i.test(text)) brand = ' إيجيبت جولد';
      else if (/سويس جولد/i.test(text)) brand = ' سويس جولد';
      else if (/ماستر جولد/i.test(text)) brand = ' ماستر جولد';

      item_name = `${kw}${brand}`;
      break;
    }
  }

  // 6. Karat
  let karat = 21;
  if (/عيار\s*24|24\s*قيراط|أربعة وعشرين|اربعه وعشرين/i.test(text)) karat = 24;
  else if (/عيار\s*18|18\s*قيراط|تمانتاشر|ثمانية عشر/i.test(text)) karat = 18;
  else if (/عيار\s*14|14\s*قيراط|أربعة عشر/i.test(text)) karat = 14;
  else if (/عيار\s*21|21\s*قيراط|واحد وعشرين/i.test(text)) karat = 21;

  // 7. Weight (Gross & Net)
  let gross_weight = 10.0;
  // Check common Arabic fractions like "خمسة جرام ونص" or "4 ونص"
  const fractionMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:جرام|جم)?\s*و\s*(نص|ربع|تلت|تلات تربع)/i);
  if (fractionMatch) {
    const base = parseFloat(fractionMatch[1]);
    const fracStr = fractionMatch[2];
    const frac = fracStr === 'نص' ? 0.5 : fracStr === 'ربع' ? 0.25 : fracStr === 'تلت' ? 0.33 : 0.75;
    gross_weight = parseFloat((base + frac).toFixed(3));
  } else {
    const wMatch = text.match(/(?:وزن|وزنه|وزنها)\s*([0-9]+(?:\.[0-9]+)?)/i) ||
                   text.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:جرام|جم)/i);
    if (wMatch && wMatch[1]) {
      gross_weight = parseFloat(parseFloat(wMatch[1]).toFixed(3));
    }
  }

  // 8. Workmanship per gram
  let workmanship_per_gram = invoice_type === 'sale' ? 120 : 0;
  const workMatch = text.match(/(?:مصنعية|المصنعية|بمصنعية)\s*([0-9]+(?:\.[0-9]+)?)/i) ||
                     text.match(/([0-9]+)\s*(?:جنيه مصنعية|ج مصنعية)/i);
  if (workMatch && workMatch[1]) {
    workmanship_per_gram = parseFloat(workMatch[1]);
  }

  return {
    invoice_type,
    customer_name,
    customer_phone,
    customer_national_id,
    item_name: item_name.includes(String(karat)) ? item_name : `${item_name} عيار ${karat}`,
    karat,
    gross_weight,
    stones_weight: 0,
    workmanship_per_gram,
  };
}

export const VoicePOSAssistantModal: React.FC<VoicePOSAssistantModalProps> = ({
  isOpen,
  onClose,
  onApplyData,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported] = useState(true);
  const [editableName, setEditableName] = useState('');
  const [editablePhone, setEditablePhone] = useState('');
  const [editableItem, setEditableItem] = useState('');
  const [editableKarat, setEditableKarat] = useState(21);
  const [editableWeight, setEditableWeight] = useState('10.0');
  const [editableWorkmanship, setEditableWorkmanship] = useState('120');
  const [editableType, setEditableType] = useState<'sale' | 'buyback'>('sale');

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-EG'; // Egyptian Arabic
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          finalTranscript += event.results[i][0].transcript;
        }
        if (finalTranscript) {
          setTranscript(finalTranscript);
          processSpeech(finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('SpeechRecognition init error:', e);
      setSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      try {
        recognitionRef.current.start();
      } catch {
        recognitionRef.current.stop();
        setTimeout(() => {
          try { recognitionRef.current.start(); } catch {}
        }, 150);
      }
    }
  };

  const processSpeech = (text: string) => {
    const data = parseEgyptianGoldSpeech(text);
    setEditableType(data.invoice_type);
    setEditableName(data.customer_name || 'عميل نقدي');
    setEditablePhone(data.customer_phone || '');
    setEditableItem(data.item_name || 'غويشة عيار 21');
    setEditableKarat(data.karat);
    setEditableWeight(String(data.gross_weight));
    setEditableWorkmanship(String(data.workmanship_per_gram));
  };

  const handleApply = () => {
    const finalData: VoiceExtractedData = {
      invoice_type: editableType,
      customer_name: editableName.trim() || 'عميل نقدي',
      customer_phone: editablePhone.trim() || undefined,
      item_name: editableItem.trim() || 'قطعة ذهب',
      karat: editableKarat,
      gross_weight: parseFloat(editableWeight) || 1.0,
      stones_weight: 0,
      workmanship_per_gram: parseFloat(editableWorkmanship) || 0,
    };
    onApplyData(finalData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative text-slate-100 space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Mic className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>المساعد الصوتي الذكي للذهب</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30 font-mono">
                  AI Voice
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                تحدث بحرية بالعامية المصرية وسيقوم المساعد بتعبئة خانات الفاتورة فورياً
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Browser Support Check */}
        {!supported && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-start gap-3 text-rose-300 text-xs">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold mb-1">المتصفح لا يدعم ميزة التعرف الصوتي المباشر</div>
              <div>يرجى استخدام متصفح Google Chrome أو Microsoft Edge للاستفادة من الإملاء الصوتي.</div>
            </div>
          </div>
        )}

        {/* Listening Pulsing Button */}
        <div className="flex flex-col items-center justify-center py-4 space-y-3">
          <button
            type="button"
            onClick={toggleListening}
            disabled={!supported}
            className={`relative group w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer shadow-2xl ${
              isListening
                ? 'bg-rose-600 shadow-rose-600/50 scale-110 animate-pulse ring-4 ring-rose-400/30'
                : 'bg-gradient-to-br from-amber-500 to-amber-600 hover:scale-105 shadow-amber-500/30'
            }`}
          >
            {isListening ? (
              <MicOff className="w-8 h-8 text-white stroke-[2.5]" />
            ) : (
              <Mic className="w-8 h-8 text-slate-950 stroke-[2.5]" />
            )}
            {isListening && (
              <span className="absolute -inset-2 rounded-full border-2 border-rose-500/50 animate-ping" />
            )}
          </button>

          <div className="text-center">
            <div className="text-sm font-bold text-slate-200">
              {isListening ? '🎙️ أستمع إليك الآن... تحدث بطبيعتك' : 'اضغط على الميكروفون للتحدث'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              مثال: "بيع للأستاذ محمد تليفونه 01012345678 خاتم عيار 21 وزنه 4 جرام ونص مصنعية 90"
            </div>
          </div>
        </div>

        {/* Speech Transcript Output */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 min-h-[50px] flex items-center">
          {transcript ? (
            <p className="text-xs text-amber-300 font-medium leading-relaxed">
              🗣️ "{transcript}"
            </p>
          ) : (
            <p className="text-xs text-slate-500 italic">
              سيظهر الكلام المنطوق هنا في نفس لحظة تحدثك...
            </p>
          )}
        </div>

        {/* Extracted Fields Preview & Confirmation */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-3">
          <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-amber-400">
              <Sparkles className="w-4 h-4" />
              <span>البيانات المستخرجة تلقائياً (يمكنك تعديل أي خانة):</span>
            </span>
            <span className="text-[10px] text-slate-400 bg-slate-700 px-2 py-0.5 rounded-lg">
              {editableType === 'sale' ? 'فاتورة بيع' : 'شراء كسر'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">نوع المعاملة</label>
              <select
                value={editableType}
                onChange={(e) => setEditableType(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="sale">بيع مصوغات للعميل</option>
                <option value="buyback">شراء كسر من العميل</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">اسم العميل</label>
              <input
                type="text"
                value={editableName}
                onChange={(e) => setEditableName(e.target.value)}
                placeholder="عميل نقدي"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">رقم هاتف العميل</label>
              <input
                type="text"
                value={editablePhone}
                onChange={(e) => setEditablePhone(e.target.value)}
                placeholder="010..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">بيان الصنف</label>
              <input
                type="text"
                value={editableItem}
                onChange={(e) => setEditableItem(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">العيار</label>
              <select
                value={editableKarat}
                onChange={(e) => setEditableKarat(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value={24}>عيار 24</option>
                <option value={21}>عيار 21</option>
                <option value={18}>عيار 18</option>
                <option value={14}>عيار 14</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">الوزن (جرام)</label>
                <input
                  type="number"
                  step="0.001"
                  value={editableWeight}
                  onChange={(e) => setEditableWeight(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-amber-300 font-bold focus:outline-none focus:border-amber-500 text-center font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">المصنعية (ج)</label>
                <input
                  type="number"
                  value={editableWorkmanship}
                  onChange={(e) => setEditableWorkmanship(e.target.value)}
                  disabled={editableType === 'buyback'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500 text-center font-mono disabled:opacity-40"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            إلغاء
          </button>
          
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold py-2.5 rounded-xl text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            <span>تطبيق وتعبئة الفاتورة فورياً</span>
          </button>
        </div>

      </div>
    </div>
  );
};
