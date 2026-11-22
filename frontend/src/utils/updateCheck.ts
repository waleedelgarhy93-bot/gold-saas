// لو التطبيق مفتوح على الموبايل من قبل ما نرفع تحديث، بيفضل شغال بالنسخة القديمة
// لحد ما حد يعمل ريفرش. هنا بنقارن اسم ملف الجافاسكريبت الحالي باللي على السيرفر،
// ولو اتغير بنظهر شريط "فيه تحديث جديد" يعمل ريفرش بضغطة.

const CHECK_EVERY_MS = 5 * 60 * 1000;

function currentBundle(): string | null {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return el ? new URL(el.src, location.href).pathname : null;
}

async function latestBundle(): Promise<string | null> {
  try {
    const res = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/\/assets\/index-[\w-]+\.js/);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

function showBanner() {
  if (document.getElementById('app-update-banner')) return;
  const bar = document.createElement('button');
  bar.id = 'app-update-banner';
  bar.type = 'button';
  bar.dir = 'rtl';
  bar.textContent = '🔄 فيه تحديث جديد للبرنامج — اضغط هنا لتحميله';
  bar.setAttribute(
    'style',
    [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
      'background:#f59e0b', 'color:#0f172a', 'font-weight:800', 'font-size:15px',
      'padding:12px 16px', 'border:none', 'cursor:pointer', 'font-family:inherit',
      'box-shadow:0 4px 16px rgba(0,0,0,.4)',
    ].join(';'),
  );
  bar.addEventListener('click', () => location.reload());
  document.body.appendChild(bar);
}

export function startUpdateCheck() {
  const running = currentBundle();
  if (!running) return; // dev server: no hashed bundle

  const check = async () => {
    const latest = await latestBundle();
    if (latest && latest !== running) showBanner();
  };

  setInterval(check, CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.addEventListener('focus', check);
}
