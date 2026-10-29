import React, { useState, useEffect } from 'react';
import type { StaffUser } from '../types';
import { fetchStaffUsers, createStaffUser, deleteStaffUser } from '../api';
import { Users, UserPlus, Trash2, CheckCircle2 } from 'lucide-react';

export const StaffManagementView: React.FC = () => {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('123');
  const [pinCode, setPinCode] = useState('2222');
  const [submitting, setSubmitting] = useState(false);

  const loadData = () => {
    fetchStaffUsers().then((data) => {
      setUsers(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !username || !password) return;
    setSubmitting(true);
    const ok = await createStaffUser({
      name,
      username,
      password,
      role: 'cashier',
      pin_code: pinCode,
    });
    setSubmitting(false);
    if (ok) {
      setShowAddModal(false);
      setName('');
      setUsername('');
      loadData();
    } else {
      alert('حدث خطأ أثناء إضافة المساعد');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('هل أنت متأكد من حذف حساب هذا المساعد؟')) {
      await deleteStaffUser(id);
      loadData();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-md">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            <span>إدارة فريق العمل والمساعدين (الكاشيرية)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            أنشئ حسابات للمساعدين في المحل مع تحديد الصلاحيات (بيع فقط ومحجوب عنهم الأسعار والميزان)
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer shadow-lg shadow-amber-500/20"
        >
          <UserPlus className="w-4 h-4 stroke-[2.5]" />
          <span>إضافة مساعد جديد</span>
        </button>
      </div>

      {/* Staff Table */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-md overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">جاري تحميل الحسابات...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-4">الاسم</th>
                  <th className="p-4">اسم الدخول</th>
                  <th className="p-4">الدور / الصلاحية</th>
                  <th className="p-4">رمز الـ PIN السريع</th>
                  <th className="p-4">الحالة</th>
                  <th className="p-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40">
                    <td className="p-4 font-sans font-bold text-slate-200">{u.name}</td>
                    <td className="p-4 text-amber-300">{u.username}</td>
                    <td className="p-4">
                      {u.role === 'shop_admin' ? (
                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-[11px] font-sans">
                          مدير المحل (جواهرجي)
                        </span>
                      ) : (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[11px] font-sans">
                          مساعد كاشير (بيع فقط)
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-slate-400">{u.pin_code || '—'}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-sans text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>نشط</span>
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {u.role !== 'shop_admin' && (
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded-lg transition cursor-pointer"
                          title="حذف الحساب"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-amber-900/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-400" />
              <span>إضافة حساب مساعد جديد</span>
            </h3>

            <form onSubmit={handleAddAssistant} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">اسم المساعد (الموظف)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثلاً: علي حسن"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">اسم المستخدم للدخول</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ali_cashier"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">كلمة المرور</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">PIN سريع (4 أرقام)</label>
                  <input
                    type="text"
                    value={pinCode}
                    maxLength={4}
                    onChange={(e) => setPinCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-[11px] leading-relaxed">
                هذا الحساب سيكون بصلاحية "مساعد كاشير": يستطيع البيع وشراء الكسر وطباعة الفواتير، لكن لا يمكنه تعديل أسعار الذهب ولا الاطلاع على ميزان الخزينة والأرباح.
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-2 rounded-xl"
                >
                  حفظ وتفعيل الحساب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
