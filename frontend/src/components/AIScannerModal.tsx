import React, { useState, useRef } from 'react';
import type { VisionAnalysisResult } from '../types';
import { analyzeImageAPI } from '../api';
import { X, Camera, Sparkles, CheckCircle2, AlertTriangle, Key } from 'lucide-react';

interface AIScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'id' | 'bullion';
  onApplyData: (data: VisionAnalysisResult) => void;
}

export const AIScannerModal: React.FC<AIScannerModalProps> = ({
  isOpen,
  onClose,
  mode,
  onApplyData,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VisionAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [showKeyInput, setShowKeyInput] = useState(!apiKey);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setError('من فضلك اختر أو التقط صورة أولاً');
      return;
    }

    setLoading(true);
    setError(null);

    if (apiKey) {
      localStorage.setItem('gemini_api_key', apiKey);
    }

    const res = await analyzeImageAPI(selectedFile, apiKey);
    setLoading(false);

    if (res.success && res.data) {
      setResult(res.data);
    } else {
      setError(res.error || 'تعذر تحليل الصورة، يرجى التحقق من اتصال الإنترنت ومفتاح الـ API');
    }
  };

  const handleApply = () => {
    if (result) {
      onApplyData(result);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-amber-900/40 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {mode === 'id' ? 'الفحص الذكي لبطاقة الرقم القومي' : 'الفحص الذكي للسبائك والدمغات'}
              </h2>
              <p className="text-xs text-slate-400">
                مدعوم بنموذج Google Gemini 2.5 Flash للاستخراج الفوري
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* API Key Banner / Config */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Key className="w-4 h-4 text-amber-400" />
            <span>مفتاح Gemini API:</span>
            <span className="font-mono text-slate-200">
              {apiKey ? `••••••••${apiKey.slice(-4)}` : 'غير مضبوط (اختياري لو الـ Backend معد)'}
            </span>
          </div>
          <button
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="text-amber-400 hover:underline text-xs"
          >
            {showKeyInput ? 'إخفاء' : 'تعديل المفتاح'}
          </button>
        </div>

        {showKeyInput && (
          <div className="space-y-1">
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="ألصق هنا AI Studio Gemini API Key (AIzaSy...)"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>
        )}

        {/* Upload & Preview Area */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-amber-500/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-950/40 hover:bg-slate-950/80 min-h-[180px]"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-amber-400 mb-3">
              <Camera className="w-6 h-6" />
            </div>
            <p className="text-xs font-semibold text-slate-200">اضغط لالتقاط بالكاميرا أو اختيار صورة</p>
            <p className="text-[11px] text-slate-500 mt-1">يدعم JPG, PNG وبطاقات الهوية</p>
          </div>

          {/* Preview */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center relative min-h-[180px]">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="w-full h-full object-contain max-h-[220px]" />
            ) : (
              <span className="text-xs text-slate-600">معاينة الصورة ستظهر هنا</span>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-rose-950/40 border border-rose-500/30 p-3 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Results Card */}
        {result && (
          <div className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>تم التعرف بنجاح (نوع: {result.detected_type})</span>
              </span>
              <span className="text-slate-400 font-mono">
                ثقة: {((result.confidence_score || 0.95) * 100).toFixed(0)}%
              </span>
            </div>

            {/* Extracted customer info */}
            {result.customer?.name && (
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[10px]">الاسم:</span>
                  <span className="font-bold text-slate-100">{result.customer.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">الرقم القومي:</span>
                  <span className="font-bold font-mono text-amber-300">{result.customer.national_id || 'غير واضح'}</span>
                </div>
              </div>
            )}

            {/* Extracted bullion/gold info */}
            {result.gold_item?.brand && (
              <div className="grid grid-cols-3 gap-2 text-xs bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[10px]">الماركة:</span>
                  <span className="font-bold text-slate-100">{result.gold_item.brand}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">الوزن المصرح:</span>
                  <span className="font-bold font-mono text-amber-300">{result.gold_item.declared_weight}g</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">السيريال:</span>
                  <span className="font-bold font-mono text-slate-300">{result.gold_item.serial_number || 'بدون'}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition"
          >
            إلغاء
          </button>

          {!result ? (
            <button
              onClick={handleAnalyze}
              disabled={loading || !selectedFile}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs transition disabled:opacity-50 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>جاري فحص الـ AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>بدء الفحص والاستخراج</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleApply}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs transition cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span>تطبيق البيانات في الفاتورة فوراً</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
