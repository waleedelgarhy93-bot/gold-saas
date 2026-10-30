import React, { useState } from 'react';
import type { User } from '../types';
import { loginAPI } from '../api';
import { Coins, Lock, User as UserIcon, AlertCircle, ArrowLeft } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
  onGoToLanding?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onGoToLanding }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await loginAPI(username, password);
    setLoading(false);

    if (res.success && res.user) {
      onLoginSuccess(res.user);
    } else {
      setError(res.error || 'اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background ambient gold glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-amber-600/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full bg-slate-900/90 border border-amber-900/40 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-600 to-amber-700 flex items-center justify-center shadow-xl shadow-amber-900/40 border border-amber-300/30 mx-auto">
            <Coins className="w-9 h-9 text-slate-950 stroke-[2.2]" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100 bg-clip-text text-transparent">
            نظام الصاغة والمجوهرات الذكي
          </h1>
          <p className="text-xs text-slate-400">سجل الدخول للمتابعة إلى حسابك</p>
        </div>

        {error && (
          <div className="bg-rose-950/40 border border-rose-500/30 p-3 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Clean Production Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">اسم المستخدم</label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">كلمة المرور</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold py-3 rounded-xl shadow-lg shadow-amber-500/20 text-sm transition cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <span>تسجيل الدخول</span>
                <ArrowLeft className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800">
          <span>نظام سحابي آمن ومشفر للصاغة</span>
          {onGoToLanding && (
            <button
              type="button"
              onClick={onGoToLanding}
              className="text-amber-400 hover:text-amber-300 font-medium cursor-pointer transition hover:underline"
            >
              صفحة مميزات النظام والاشتراك ←
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
