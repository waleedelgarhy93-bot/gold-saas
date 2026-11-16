import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { formatSpokenForField, type FieldVoiceType } from '../utils/arabicVoiceParser';

export interface FieldVoiceButtonProps {
  fieldType: FieldVoiceType;
  fieldLabel: string;
  onValueChange: (value: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export const FieldVoiceButton: React.FC<FieldVoiceButtonProps> = ({
  fieldType,
  fieldLabel,
  onValueChange,
  className = '',
  size = 'sm'
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [interimText, setInterimText] = useState('');

  const recognitionRef = useRef<any>(null);
  const shouldBeListeningRef = useRef(false);
  const accumulatedRef = useRef('');
  const silenceTimerRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
    }

    return () => {
      shouldBeListeningRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  const stopListening = () => {
    shouldBeListeningRef.current = false;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsListening(false);
    setInterimText('');
  };

  const startListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('متصفحك لا يدعم الإملاء الصوتي المباشر. يرجى استخدام متصفح Google Chrome.');
      return;
    }

    try {
      if (navigator.vibrate) navigator.vibrate(40);
    } catch {}

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    shouldBeListeningRef.current = true;
    accumulatedRef.current = '';
    setInterimText('');

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-EG';
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      recognition.continuous = !isMobile;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let currentUtterance = '';
        for (let i = 0; i < event.results.length; ++i) {
          currentUtterance += event.results[i][0].transcript + ' ';
        }
        currentUtterance = currentUtterance.trim();

        const combined = (accumulatedRef.current + ' ' + currentUtterance).trim();
        if (combined) {
          setInterimText(combined);
          const formatted = formatSpokenForField(combined, fieldType);
          if (formatted) {
            onValueChange(formatted);
          }
        }

        // Reset silence timer on speech activity: auto finalize after 1.8s of silence
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (shouldBeListeningRef.current) {
            stopListening();
          }
        }, 1800);
      };

      recognition.onerror = (event: any) => {
        console.warn('Field voice recognition error:', event.error);
        if (event.error === 'not-allowed') {
          shouldBeListeningRef.current = false;
          setIsListening(false);
          alert('⚠️ تم حظر إذن الميكروفون. يرجى السماح للمتصفح بالوصول إلى الميكروفون.');
        } else if (event.error === 'network') {
          shouldBeListeningRef.current = false;
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        if (shouldBeListeningRef.current) {
          if (interimText) {
            accumulatedRef.current = (accumulatedRef.current + ' ' + interimText).trim();
          }
          try {
            recognition.start();
          } catch {
            setTimeout(() => {
              if (shouldBeListeningRef.current) {
                try { recognition.start(); } catch {}
              }
            }, 100);
          }
        } else {
          setIsListening(false);
          setInterimText('');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Error starting field speech recognition:', err);
      shouldBeListeningRef.current = false;
      setIsListening(false);
    }
  };

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!isSupported) return null;

  const btnSize = size === 'sm' ? 'w-6 h-6 p-1' : 'w-7 h-7 p-1.5';
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={toggleListening}
        title={isListening ? 'اضغط لإيقاف الاستماع' : `تحدث لإملاء ${fieldLabel}`}
        className={`flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer ${btnSize} ${
          isListening
            ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/50 ring-2 ring-rose-400 animate-pulse scale-110'
            : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800/80 bg-slate-900/60 border border-slate-700/50'
        }`}
      >
        {isListening ? (
          <MicOff className={`${iconSize} stroke-[2.5]`} />
        ) : (
          <Mic className={`${iconSize} stroke-[2]`} />
        )}
      </button>

      {/* Floating listening indicator bubble */}
      {isListening && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-30 pointer-events-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150">
          <div className="bg-slate-900/95 border border-rose-500/80 text-rose-300 text-[11px] px-2.5 py-1 rounded-xl shadow-xl flex items-center gap-1.5 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
            <span className="font-bold">أستمع لـ {fieldLabel}...</span>
            {interimText && (
              <span className="text-amber-300 max-w-[120px] truncate text-[10px]">
                ({interimText})
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
