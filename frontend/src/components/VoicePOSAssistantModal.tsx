import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Sparkles, CheckCircle2, AlertCircle, X, Volume2 } from 'lucide-react';
import type { GoldPrices } from '../types';
import { normalizeNumber } from '../utils/numbers';

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
export function normalizeArabicDigits(str: string): string {
  return str.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

// Intelligent extractor for Egyptian Gold Shop speech patterns
export function parseEgyptianGoldSpeech(rawText: string): VoiceExtractedData {
  const text = normalizeArabicDigits(rawText.trim());

  // 1. Transaction Type
  let invoice_type: 'sale' | 'buyback' = 'sale';
  if (/شراء|كسر|نشتري|نشترى|هنشتري|مرتجع|شاريين/i.test(text)) {
    invoice_type = 'buyback';
  } else if (/بيع|نبيع|أبيع|هنبيع|مباع/i.test(text)) {
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
  let customer_name = '';
  const stopWordsPattern = '(?:رقم|تليفون|تليفونه|موبايل|هاتف|تلفون|خاتم|دبلة|سلسلة|غويشة|غوايش|حلق|انسيال|سبيكة|جنيه|كسر|عيار|وزن|وزنه|وزنها|مصنعية|مصنعيتها|انا|أنا|احنا|إحنا|هبيع|هشتري|بيع|شراء|الصنف|اسم الصنف|اسم الخاتم|اسم القطعة|القطعة)';

  const nameRegexes = [
    new RegExp('(?:اسم\\s*العميل|اسم\\s*الزبون|اسم\\s*المشتري|العميل|الزبون|المشتري|باسم|اسمه|اسمها)(?:\\s+هو|\\s*:)?\\s+([^\\d,\\.\\n]+?)(?=\\s+' + stopWordsPattern + '|$)', 'i'),
    new RegExp('(?:للأستاذ|للاستاذ|للأستاذة|للاستاذة|للمهندس|للدكتور|للحاج|للحاجة|للمدام|للعميل|للسيد)(?:\\s+هو|\\s*:)?\\s+([^\\d,\\.\\n]+?)(?=\\s+' + stopWordsPattern + '|$)', 'i'),
    new RegExp('(?:بيع\\s*لـ?|شراء\\s*من|بيع\\s*لل)(?:\\s+هو|\\s*:)?\\s+([^\\d,\\.\\n]+?)(?=\\s+' + stopWordsPattern + '|$)', 'i')
  ];

  for (const reg of nameRegexes) {
    const match = text.match(reg);
    if (match && match[1]) {
      const cleaned = match[1].replace(/(?:أستاذ|استاذ|حاج|مدام|دكتور|مهندس|هو|هي)/g, '').trim();
      if (cleaned.length >= 2 && !/^(بيع|شراء|خاتم|دبلة|غويشة|سبيكة|جنيه)$/.test(cleaned)) {
        customer_name = cleaned;
        break;
      }
    }
  }

  // 5. Item Name / Ring Name
  let item_name = '';

  // Check explicit item phrases e.g. 'اسم الخاتم خاتم لازوردي' or 'الصنف خاتم'
  const explicitItemMatch = text.match(/(?:اسم\s*الخاتم|اسم\s*الصنف|الصنف|اسم\s*القطعة|القطعة|نوع\s*القطعة)(?:\s+هو|\s*:)?\s+([^\d,\.\n]+?)(?=\s+(?:عيار|وزن|وزنه|مصنعية|رقم|تليفون|اسم العميل|$))/i);
  if (explicitItemMatch && explicitItemMatch[1]) {
    const exp = explicitItemMatch[1].trim();
    if (exp.length >= 2 && !/^(هو|هي)$/.test(exp)) {
      item_name = exp;
    }
  }

  if (!item_name) {
    const itemKeywords = [
      'خاتم', 'دبلة', 'غويشة', 'غوايش', 'سلسلة', 'سلاسل', 'كوليه', 'حلق', 'حلقان',
      'انسيال', 'اسورة', 'سوار', 'سبيكة', 'سبائك', 'جنيه', 'نصف جنيه', 'ربع جنيه',
      'توينز', 'محبس', 'تعليقة', 'مدالية', 'كف', 'عقد', 'مصحف ذهب', 'كسر ذهب', 'ذهب كسر'
    ];

    for (const kw of itemKeywords) {
      if (text.includes(kw)) {
        // Look for descriptive brand/style word immediately following kw
        const kwRegex = new RegExp('(' + kw + '(?:\\s+(?:لازوردي|btc|بي\\s*تي\\s*سي|إيجيبت\\s*جولد|سويس\\s*جولد|ماستر\\s*جولد|كارتير|سوليتير|سولتير|رجالي|حريمي|أطفال|ذهب|أبيض|اصفر))?)', 'i');
        const m = text.match(kwRegex);
        if (m && m[1]) {
          item_name = m[1].trim();
        } else {
          item_name = kw;
        }
        break;
      }
    }
  }

  if (!item_name) {
    item_name = invoice_type === 'sale' ? 'خاتم عيار 21' : 'كسر ذهب عيار 21';
  }

  // 6. Karat
  let karat = 21;
  if (/عيار\s*24|24\s*قيراط|أربعة وعشرين|اربعه وعشرين/i.test(text)) karat = 24;
  else if (/عيار\s*18|18\s*قيراط|تمانتاشر|ثمانية عشر/i.test(text)) karat = 18;
  else if (/عيار\s*14|14\s*قيراط|أربعة عشر/i.test(text)) karat = 14;
  else if (/عيار\s*21|21\s*قيراط|واحد وعشرين/i.test(text)) karat = 21;

  if (!item_name.includes(String(karat)) && !/سبيكة|جنيه/.test(item_name)) {
    item_name = `${item_name} عيار ${karat}`;
  }

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
    customer_name: customer_name || 'عميل نقدي',
    customer_phone,
    customer_national_id,
    item_name,
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [editableName, setEditableName] = useState('');
  const [editablePhone, setEditablePhone] = useState('');
  const [editableItem, setEditableItem] = useState('');
  const [editableKarat, setEditableKarat] = useState(21);
  const [editableWeight, setEditableWeight] = useState('10.0');
  const [editableWorkmanship, setEditableWorkmanship] = useState('120');
  const [editableType, setEditableType] = useState<'sale' | 'buyback'>('sale');

  const recognitionRef = useRef<any>(null);
  const shouldBeListeningRef = useRef(false);
  const fullAccumulatedTranscriptRef = useRef('');
  const currentSessionTranscriptRef = useRef('');

  // Check if browser supports SpeechRecognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
    }

    return () => {
      shouldBeListeningRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  const requestMicAndToggle = () => {
    setErrorMessage(null);

    // If currently listening, stop it explicitly
    if (isListening || shouldBeListeningRef.current) {
      shouldBeListeningRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage('متصفح هذا الهاتف لا يدعم ميزة التسجيل الصوتي المباشر. يرجى استخدام Google Chrome أو Edge.');
      setSupported(false);
      return;
    }

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Abort any old instance
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    // Mark intent as actively listening
    shouldBeListeningRef.current = true;
    fullAccumulatedTranscriptRef.current = '';
    currentSessionTranscriptRef.current = '';
    setTranscript('');

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-EG'; // Egyptian Arabic
      // On mobile (Android/iOS), continuous must be false to avoid speech engine abort/crash
      recognition.continuous = !isMobile;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
      };

      recognition.onresult = (event: any) => {
        let segment = '';
        for (let i = 0; i < event.results.length; ++i) {
          segment += event.results[i][0].transcript + ' ';
        }
        currentSessionTranscriptRef.current = segment.trim();

        const combined = (fullAccumulatedTranscriptRef.current + ' ' + currentSessionTranscriptRef.current).trim();
        if (combined) {
          setTranscript(combined);
          processSpeech(combined);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error event:', event.error);
        if (event.error === 'not-allowed') {
          shouldBeListeningRef.current = false;
          setErrorMessage('⚠️ تم حظر إذن الميكروفون من الهاتف. اضغط على رمز القفل 🔒 أعلى الشاشة بجوار الرابط وفعّل الميكروفون (Allow Microphone).');
          setIsListening(false);
        } else if (event.error === 'network') {
          shouldBeListeningRef.current = false;
          setErrorMessage('⚠️ خدمة الصوت تتطلب اتصالاً بالإنترنت. يمكنك كتابة البيانات في الصندوق أدناه لتحليلها.');
          setIsListening(false);
        } else if (event.error === 'audio-capture') {
          shouldBeListeningRef.current = false;
          setErrorMessage('⚠️ تعذر تشغيل الميكروفون. تأكد من إغلاق أي تطبيق آخر يستخدم الصوت.');
          setIsListening(false);
        } else if (event.error === 'no-speech') {
          // Normal silence pause, keep listening!
        }
      };

      recognition.onend = () => {
        // If user has not stopped, auto-restart to keep listening continuously across pauses!
        if (shouldBeListeningRef.current) {
          if (currentSessionTranscriptRef.current) {
            fullAccumulatedTranscriptRef.current = (fullAccumulatedTranscriptRef.current + ' ' + currentSessionTranscriptRef.current).trim();
            currentSessionTranscriptRef.current = '';
          }
          try {
            recognition.start();
          } catch {
            setTimeout(() => {
              if (shouldBeListeningRef.current) {
                try { recognition.start(); } catch {}
              }
            }, 120);
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;

      // Directly invoke start() synchronously in the user touch event
      recognition.start();
    } catch (err: any) {
      console.warn('SpeechRecognition direct start error:', err);
      shouldBeListeningRef.current = false;
      setErrorMessage('تعذر بدء الميكروفون. تأكد من استخدام متصفح Chrome ومنح الصلاحية.');
      setIsListening(false);
    }
  };

  const processSpeech = (text: string) => {
    const data = parseEgyptianGoldSpeech(text);
    setEditableType(data.invoice_type);
    if (data.customer_name) {
      setEditableName(data.customer_name);
    }
    if (data.customer_phone) {
      setEditablePhone(data.customer_phone);
    }
    if (data.item_name) {
      setEditableItem(data.item_name);
    }
    setEditableKarat(data.karat);
    setEditableWeight(String(data.gross_weight));
    setEditableWorkmanship(String(data.workmanship_per_gram));
  };

  const handleManualTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTranscript(val);
    if (val.trim()) {
      processSpeech(val);
    }
  };

  const handleLoadSample = (sampleText: string) => {
    setTranscript(sampleText);
    processSpeech(sampleText);
  };

  const handleClose = () => {
    shouldBeListeningRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsListening(false);
    onClose();
  };

  const handleApply = () => {
    shouldBeListeningRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsListening(false);

    const finalData: VoiceExtractedData = {
      invoice_type: editableType,
      customer_name: editableName.trim() || 'عميل نقدي',
      customer_phone: editablePhone.trim() || undefined,
      item_name: editableItem.trim() || 'خاتم عيار 21',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Mic className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>المساعد الصوتي الذكي للصاغة</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30 font-mono">
                  AI Voice
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                تحدث بحرية بالعامية وسيقوم المساعد بملء الفاتورة وإضافة الصنف تلقائياً
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error / Permission Banner */}
        {errorMessage && (
          <div className="bg-rose-500/15 border border-rose-500/40 rounded-2xl p-3 flex items-start gap-2.5 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Browser Not Supported Warning */}
        {!supported && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-start gap-2.5 text-amber-300 text-xs">
            <Volume2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">المتصفح لا يدعم ميزة التسجيل الصوتي المباشر</div>
              <div>يرجى استخدام Google Chrome أو Edge، أو يمكنك كتابة الجملة في المربع أدناه للتحليل الفوري.</div>
            </div>
          </div>
        )}

        {/* Main Mic Button & Pulse Animation */}
        <div className="flex flex-col items-center justify-center py-2 space-y-2">
          <button
            type="button"
            onClick={requestMicAndToggle}
            className={`relative group w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer shadow-2xl ${
              isListening
                ? 'bg-rose-600 shadow-rose-600/50 scale-110 ring-4 ring-rose-400/40 animate-pulse'
                : 'bg-gradient-to-br from-amber-500 to-amber-600 hover:scale-105 shadow-amber-500/30'
            }`}
          >
            {isListening ? (
              <MicOff className="w-8 h-8 text-white stroke-[2.5]" />
            ) : (
              <Mic className="w-8 h-8 text-slate-950 stroke-[2.5]" />
            )}
            {isListening && (
              <span className="absolute -inset-2.5 rounded-full border-2 border-rose-500/50 animate-ping" />
            )}
          </button>

          <div className="text-center">
            <div className="text-sm font-bold text-slate-200">
              {isListening ? (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-rose-400 flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    الميكروفون مستمر في الاستماع (تحدث براحتك وبطبيعتك)
                  </span>
                  <span className="text-[11px] text-amber-300/90 font-normal">
                    لن يقفل لوحده.. اضغط على الزر الأحمر عند الانتهاء من الكلام
                  </span>
                </div>
              ) : (
                'اضغط وتحدث لإملاء الفاتورة'
              )}
            </div>
          </div>

          {/* Quick Examples */}
          <div className="w-full flex flex-wrap items-center justify-center gap-1.5 pt-1">
            <span className="text-[10px] text-slate-400">نماذج تجربة سريعة:</span>
            <button
              type="button"
              onClick={() => handleLoadSample('بيع للأستاذ محمد تليفونه 01012345678 خاتم لازوردي عيار 21 وزنه 4 جرام ونص المصنعية 90')}
              className="text-[10px] bg-slate-800 hover:bg-slate-700 text-amber-300 px-2 py-0.5 rounded-lg border border-slate-700 transition cursor-pointer"
            >
              خاتم لازوردي عيار 21 (4.5 جم)
            </button>
            <button
              type="button"
              onClick={() => handleLoadSample('شراء كسر من الحاج إبراهيم عيار 18 وزنه 12 جرام')}
              className="text-[10px] bg-slate-800 hover:bg-slate-700 text-amber-300 px-2 py-0.5 rounded-lg border border-slate-700 transition cursor-pointer"
            >
              شراء كسر عيار 18 (12 جم)
            </button>
          </div>
        </div>

        {/* Live Transcript / Manual Input */}
        <div>
          <label className="text-[11px] text-slate-400 mb-1 flex items-center justify-between">
            <span>النص المنطوق (أو اكتب هنا للتعديل والتحليل):</span>
            {transcript && <span className="text-[10px] text-emerald-400">تم التحليل الفوري ✓</span>}
          </label>
          <input
            type="text"
            value={transcript}
            onChange={handleManualTextChange}
            placeholder="مثال: بيع لمحمد تليفونه 010... خاتم عيار 21 وزنه 5 جرام مصنعية 100"
            className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs text-amber-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 font-medium"
          />
        </div>

        {/* Extracted Fields Preview & Confirmation */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-3">
          <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-amber-400">
              <Sparkles className="w-4 h-4" />
              <span>البيانات المستخرجة (جاهزة للتطبيق):</span>
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold ${editableType === 'sale' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
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
                  type="text"
                    inputMode="decimal"
                  step="0.001"
                  value={editableWeight}
                  onChange={(e) => setEditableWeight(normalizeNumber(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-amber-300 font-bold focus:outline-none focus:border-amber-500 text-center font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">المصنعية (ج)</label>
                <input
                  type="text"
                    inputMode="decimal"
                  value={editableWorkmanship}
                  onChange={(e) => setEditableWorkmanship(normalizeNumber(e.target.value))}
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
            onClick={handleClose}
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
            <span>تطبيق وإضافة الصنف للفاتورة فوراً</span>
          </button>
        </div>

      </div>
    </div>
  );
};
