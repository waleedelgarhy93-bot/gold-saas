import React from 'react';
import { 
  Coins, Sparkles, Scale, Receipt, ShieldCheck, Smartphone, 
  CheckCircle2, ArrowLeft, MessageCircle, Zap, Eye, Building2 
} from 'lucide-react';

interface MarketingLandingProps {
  onGoToLogin: () => void;
}

export const MarketingLanding: React.FC<MarketingLandingProps> = ({ onGoToLogin }) => {
  const WHATSAPP_NUMBER = '201012350680'; // WhatsApp for subscription
  const WHATSAPP_MSG = encodeURIComponent('السلام عليكم أستاذ وليد، أود الاستفسار عن الاشتراك في نظام الصاغة والمجوهرات الذكي وتفعيل نسخة لمحل الذهب.');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950 overflow-x-hidden">
      {/* Top Navbar */}
      <nav className="border-b border-amber-900/30 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-600 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-900/30 border border-amber-300/30">
              <Coins className="w-6 h-6 text-slate-950 stroke-[2.2]" />
            </div>
            <div>
              <span className="text-base sm:text-lg font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100 bg-clip-text text-transparent">
                نظام الصاغة والمجوهرات الذكي
              </span>
              <span className="mr-2 text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-mono">
                SaaS Cloud
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span>تواصل واتساب</span>
            </a>

            <button
              onClick={onGoToLogin}
              className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <span>دخول النظام</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center space-y-6">
        {/* Ambient Gold Glows */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-4 py-1.5 rounded-full text-amber-300 text-xs sm:text-sm font-semibold">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>أول نظام سحابي مصري لإدارة محلات الصاغة مدعوم بالذكاء الاصطناعي</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight max-w-4xl mx-auto">
          أدِر مبيعات الذهب والكسر والميزان <br />
          <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100 bg-clip-text text-transparent">
            بدقة الصائغ وسرعة السحابة
          </span>
        </h1>

        <p className="text-slate-400 text-sm sm:text-lg max-w-2xl mx-auto leading-relaxed">
          نظام سحابي متكامل ومصمم خصيصاً لتجارة وتجزئة الذهب والمجوهرات. يحميك من التلاعب بفضل فحص الهوية والسبائك بالـ AI، مع ربط مباشر ببورصة الذهب وطباعة حرارية فورية.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-7 py-3.5 rounded-2xl shadow-xl shadow-amber-500/25 transition text-sm cursor-pointer"
          >
            <MessageCircle className="w-5 h-5" />
            <span>طلب تفعيل اشتراك لمحل صاغة</span>
          </a>

          <button
            onClick={onGoToLogin}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 px-6 py-3.5 rounded-2xl font-bold transition text-sm cursor-pointer"
          >
            <Eye className="w-4 h-4 text-amber-400" />
            <span>تجربة النظام (عرض توضيحي)</span>
          </button>
        </div>

        {/* Trust Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-12 max-w-4xl mx-auto text-center">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">100%</p>
            <p className="text-xs text-slate-400 mt-1">سحابي بدون أجهزة سيرفر معقدة</p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">21k / 24k</p>
            <p className="text-xs text-slate-400 mt-1">حساب تلقائي للمعادل الذهبي</p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">&lt; 1 ثانية</p>
            <p className="text-xs text-slate-400 mt-1">مسح بطاقة الرقم القومي بالـ AI</p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">PWA</p>
            <p className="text-xs text-slate-400 mt-1">تطبيق يعمل على الموبايل والكمبيوتر</p>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="py-16 bg-slate-900/50 border-y border-slate-800/80 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-4xl font-bold">لماذا يختار أصحاب الصاغة هذا النظام؟</h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              حلول عملية مبنية على واقع سوق الذهب المصري وحسابات المصنعية والدمغة وحماية المحل قانونياً.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 p-6 rounded-2xl space-y-3 transition group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-110 transition">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">فحص الهوية بالذكاء الاصطناعي</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                عند شراء كسر أو ذهب مستعمل من الزبون، التقط بطاقة الرقم القومي بكاميرا الموبايل، وسيقوم الـ AI باستخراج الاسم والرقم وتوثيقهما في الفاتورة لحماية المحل قانونياً.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 p-6 rounded-2xl space-y-3 transition group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-110 transition">
                <Scale className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">ميزان الذهب والجرد الدوري</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                ضبط رصيد المحل بالجرامات بدقة مطلقة، مع تحويل كافة الأوزان والعيارات (18، 21، 24) إلى المعادل الذهبي عيار 21 تلقائياً ومعرفة أرباح المصنعية الصافية.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 p-6 rounded-2xl space-y-3 transition group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-110 transition">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">فواتير حرارية وإرسال واتساب</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                طباعة فورية للفاتورة على جميع الطابعات الحرارية (Thermal 80mm/58mm)، مع إمكانية إرسال نسخة الفاتورة وتفاصيل الذهب والمصنعية للزبون عبر واتساب بضغطة زر.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 p-6 rounded-2xl space-y-3 transition group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-110 transition">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">تطبيق مثبت على الموبايل (PWA)</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                لا يحتاج إلى كمبيوتر ضخم في المحل، يمكنك تثبيت التطبيق على هاتف صاحب المحل أو الكاشير أو التابلت ليعمل بكفاءة وشاشة كاملة مثل التطبيقات الأصلية.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 p-6 rounded-2xl space-y-3 transition group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-110 transition">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">صلاحيات محكمة لفريق العمل</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                لوحة تحكم خاصة لصاحب المحل لتعديل الأسعار وإدارة الكاشيرية وعرض أرباح اليوم، مع تقييد المساعدين في نقطة البيع فقط لمنع التلاعب في أسعار الجرام أو الحسابات.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 p-6 rounded-2xl space-y-3 transition group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-110 transition">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">تحديث لحظي لأسعار البورصة</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                شريط أسعار ذهب حي ومباشر أعلى الشاشة لعيارات 24، 21، 18 وسعر الجنيه الذهب، للتسعير الفوري للبيع والشراء مع تقلبات السوق اليومية.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Transparent Fixed Subscription Pricing Plan */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center space-y-10">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full text-xs font-semibold border border-amber-500/30">
            <Building2 className="w-4 h-4" />
            <span>اشتراك سحابي موحّد وثابت لكل المحلات</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold">باقة محل الصاغة الشاملة</h2>
          <p className="text-sm text-slate-400 max-w-lg mx-auto">
            اشتراك سنوي أو نصف سنوي ثابت وشامل لكافة المميزات بدون أي مصاريف خفية أو تكاليف إضافية لكل فاتورة.
          </p>
        </div>

        {/* The Card */}
        <div className="max-w-lg mx-auto bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-500/60 rounded-3xl p-8 sm:p-10 shadow-2xl relative text-right space-y-6">
          <div className="absolute -top-4 right-1/2 translate-x-1/2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold px-4 py-1 rounded-full text-xs shadow-md">
            الباقة المتكاملة (All-in-One)
          </div>

          <div className="text-center space-y-2 border-b border-slate-800 pb-6">
            <h3 className="text-xl font-bold text-slate-100">اشتراك المحل السحابي</h3>
            <p className="text-xs text-slate-400">يشمل السيرفر، قاعدة البيانات، والذكاء الاصطناعي</p>
            <div className="pt-2">
              <span className="text-4xl sm:text-5xl font-extrabold text-amber-400 font-mono">قيمة ثابتة</span>
              <span className="text-xs text-slate-400 mr-2">/ اشتراك سنوي للمحل</span>
            </div>
          </div>

          {/* Features Checklist */}
          <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>نقطة بيع وشراء كسر غير محدودة الفواتير</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>مسح وفحص بطاقات الرقم القومي والسبائك بالذكاء الاصطناعي</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>نظام ميزان الذهب والجرد بالمعادل الذهبي عيار 21</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>طباعة حرارية 80mm وإرسال فواتير واتساب للزبون</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>تطبيق PWA مثبت على الهواتف والأجهزة اللوحية</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>تعدد المستخدمين (صاحب المحل + كاشيرية ومساعدين)</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>نسخ احتياطي تلقائي يومي وحماية مشددة لبيانات المحل</span>
            </li>
          </ul>

          <div className="pt-4 space-y-3">
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold py-3.5 rounded-xl text-sm shadow-xl shadow-amber-500/20 transition cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>تواصل لتفعيل حساب محلك الآن</span>
            </a>

            <p className="text-center text-[11px] text-slate-400">
              الدفع متاح عبر فودافون كاش / إنستاباي / التحويل البنكي
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950 py-8 px-4 text-center text-xs text-slate-400 space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Coins className="w-4 h-4 text-amber-500" />
          <span className="font-bold text-slate-300">منصة الصاغة والمجوهرات الذكية (L'Hopital Gold SaaS)</span>
        </div>
        <p>تصميم وتطوير: أ/ وليد الجارحي (مقدم) — معلم خبير رياضيات وباحث برمجيات</p>
        <p className="text-[11px] text-slate-400 font-mono">ORCID: 0009-0000-7323-2062 | Minya, Egypt</p>
      </footer>
    </div>
  );
};
