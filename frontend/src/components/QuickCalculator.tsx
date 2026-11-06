import React, { useState, useEffect } from 'react';
import { Calculator as CalcIcon, X, Delete, Copy, Check } from 'lucide-react';

interface QuickCalculatorProps {
  onInsertValue?: (val: number) => void;
}

export const QuickCalculator: React.FC<QuickCalculatorProps> = ({ onInsertValue }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [display, setDisplay] = useState('0');
  const [history, setHistory] = useState('');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [newNumberStarted, setNewNumberStarted] = useState(true);
  const [copied, setCopied] = useState(false);

  const clearAll = () => {
    setDisplay('0');
    setHistory('');
    setPrevValue(null);
    setOperation(null);
    setNewNumberStarted(true);
  };

  const deleteDigit = () => {
    if (newNumberStarted) return;
    if (display.length <= 1 || (display.length === 2 && display.startsWith('-'))) {
      setDisplay('0');
      setNewNumberStarted(true);
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  const inputDigit = (digit: string) => {
    if (newNumberStarted) {
      setDisplay(digit === '.' ? '0.' : digit);
      setNewNumberStarted(false);
    } else {
      if (digit === '.' && display.includes('.')) return;
      if (display === '0' && digit !== '.') {
        setDisplay(digit);
      } else {
        setDisplay(display + digit);
      }
    }
  };

  const toggleSign = () => {
    const val = parseFloat(display);
    if (!isNaN(val) && val !== 0) {
      setDisplay(String(-val));
    }
  };

  const executeOperation = (prev: number, curr: number, op: string): number => {
    switch (op) {
      case '+': return prev + curr;
      case '-': return prev - curr;
      case '×': return prev * curr;
      case '÷': return curr !== 0 ? prev / curr : 0;
      default: return curr;
    }
  };

  const handleOperator = (op: string) => {
    const current = parseFloat(display);
    if (isNaN(current)) return;

    if (prevValue === null) {
      setPrevValue(current);
      setHistory(`${current} ${op}`);
    } else if (operation && !newNumberStarted) {
      const result = executeOperation(prevValue, current, operation);
      const rounded = Math.round(result * 10000) / 10000;
      setPrevValue(rounded);
      setDisplay(String(rounded));
      setHistory(`${rounded} ${op}`);
    } else {
      setHistory(`${prevValue} ${op}`);
    }

    setOperation(op);
    setNewNumberStarted(true);
  };

  const handlePercentage = () => {
    const current = parseFloat(display);
    if (isNaN(current)) return;

    if (prevValue !== null && operation) {
      // Commercial jewelry math: A + B% = A + (A * B / 100)
      let percentVal = (prevValue * current) / 100;
      if (operation === '×' || operation === '÷') {
        percentVal = current / 100;
      }
      const rounded = Math.round(percentVal * 10000) / 10000;
      setDisplay(String(rounded));
      setNewNumberStarted(false);
    } else {
      // Just X% = X / 100
      const res = current / 100;
      setDisplay(String(res));
      setNewNumberStarted(true);
    }
  };

  const handleEquals = () => {
    const current = parseFloat(display);
    if (prevValue === null || !operation || isNaN(current)) return;

    const result = executeOperation(prevValue, current, operation);
    const rounded = Math.round(result * 10000) / 10000;

    setHistory(`${prevValue} ${operation} ${current} =`);
    setDisplay(String(rounded));
    setPrevValue(null);
    setOperation(null);
    setNewNumberStarted(true);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(display);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Keyboard support when calculator is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        inputDigit(e.key);
      } else if (e.key === '.') {
        inputDigit('.');
      } else if (e.key === '+') {
        handleOperator('+');
      } else if (e.key === '-') {
        handleOperator('-');
      } else if (e.key === '*') {
        handleOperator('×');
      } else if (e.key === '/') {
        e.preventDefault();
        handleOperator('÷');
      } else if (e.key === '%') {
        handlePercentage();
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEquals();
      } else if (e.key === 'Backspace') {
        deleteDigit();
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, display, prevValue, operation, newNumberStarted]);

  return (
    <>
      {/* Floating Toggle Button (Always visible on bottom-left, hidden when printing) */}
      <div className="fixed bottom-5 left-5 z-40 no-print">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-full font-bold shadow-2xl transition-all duration-200 border ${
            isOpen
              ? 'bg-amber-500 text-slate-950 border-amber-400 scale-105 shadow-amber-500/30'
              : 'bg-slate-900/95 text-amber-400 hover:text-amber-300 border-amber-500/40 hover:border-amber-400 hover:scale-105 shadow-black/60'
          }`}
          title="آلة حاسبة سريعة"
        >
          <CalcIcon className="w-5 h-5" />
          <span className="text-xs">حاسبة الصاغة</span>
        </button>
      </div>

      {/* Floating Calculator Modal / Panel */}
      {isOpen && (
        <div className="fixed bottom-20 left-5 z-50 w-72 bg-slate-900 border-2 border-amber-500/50 rounded-2xl shadow-2xl p-4 text-white font-sans no-print animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
              <CalcIcon className="w-4 h-4 text-amber-400" />
              <span>آلة حاسبة</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleCopy}
                className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                title="نسخ الناتج"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Screen Display */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 mb-3 text-left">
            <div className="text-[11px] text-amber-500/80 font-mono h-4 overflow-hidden truncate" dir="ltr">
              {history}
            </div>
            <div className="text-2xl font-black text-white font-mono tracking-wider overflow-x-auto whitespace-nowrap mt-1" dir="ltr">
              {display}
            </div>
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-4 gap-1.5 text-sm font-bold">
            {/* Row 1 */}
            <button
              type="button"
              onClick={clearAll}
              className="py-2.5 rounded-lg bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-800/40 transition-colors"
            >
              C
            </button>
            <button
              type="button"
              onClick={deleteDigit}
              className="py-2.5 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="مسح رقم"
            >
              <Delete className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handlePercentage}
              className="py-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors text-base"
              title="نسبة مئوية (%)"
            >
              %
            </button>
            <button
              type="button"
              onClick={() => handleOperator('÷')}
              className="py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-black transition-colors text-base"
            >
              ÷
            </button>

            {/* Row 2 */}
            <button
              type="button"
              onClick={() => inputDigit('7')}
              className="py-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-white font-mono text-base transition-colors"
            >
              7
            </button>
            <button
              type="button"
              onClick={() => inputDigit('8')}
              className="py-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-white font-mono text-base transition-colors"
            >
              8
            </button>
            <button
              type="button"
              onClick={() => inputDigit('9')}
              className="py-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-white font-mono text-base transition-colors"
            >
              9
            </button>
            <button
              type="button"
              onClick={() => handleOperator('×')}
              className="py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-black transition-colors text-base"
            >
              ×
            </button>

            {/* Row 3 */}
            <button
              type="button"
              onClick={() => inputDigit('4')}
              className="py-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-white font-mono text-base transition-colors"
            >
              4
            </button>
            <button
              type="button"
              onClick={() => inputDigit('5')}
              className="py-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-white font-mono text-base transition-colors"
            >
              5
            </button>
            <button
              type="button"
              onClick={() => inputDigit('6')}
              className="py-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-white font-mono text-base transition-colors"
            >
              6
            </button>
            <button
              type="button"
              onClick={() => handleOperator('-')}
              className="py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-black transition-colors text-base"
            >
              -
            </button>

            {/* Row 4 */}
            <button
              type="button"
              onClick={() => inputDigit('1')}
              className="py-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-white font-mono text-base transition-colors"
            >
              1
            </button>
            <button
              type="button"
              onClick={() => inputDigit('2')}
              className="py-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-white font-mono text-base transition-colors"
            >
              2
            </button>
            <button
              type="button"
              onClick={() => inputDigit('3')}
              className="py-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-white font-mono text-base transition-colors"
            >
              3
            </button>
            <button
              type="button"
              onClick={() => handleOperator('+')}
              className="py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-black transition-colors text-base"
            >
              +
            </button>

            {/* Row 5 */}
            <button
              type="button"
              onClick={toggleSign}
              className="py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-sm transition-colors"
            >
              ±
            </button>
            <button
              type="button"
              onClick={() => inputDigit('0')}
              className="py-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-white font-mono text-base transition-colors"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => inputDigit('.')}
              className="py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-base transition-colors"
            >
              .
            </button>
            <button
              type="button"
              onClick={handleEquals}
              className="py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-lg transition-colors shadow-lg shadow-amber-500/20"
            >
              =
            </button>
          </div>

          {/* Quick Insert / Paste into invoice if needed */}
          {onInsertValue && (
            <button
              type="button"
              onClick={() => onInsertValue(parseFloat(display) || 0)}
              className="w-full mt-2.5 py-1.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-bold transition-colors"
            >
              إدراج الناتج في الفاتورة
            </button>
          )}
        </div>
      )}
    </>
  );
};
