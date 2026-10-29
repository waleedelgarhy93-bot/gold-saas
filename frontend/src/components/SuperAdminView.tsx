import React, { useState, useEffect } from 'react';
import type { SubscriberShop } from '../types';
import { fetchSubscriberShops, adminUpdateShopAPI, adminCreateShopAPI } from '../api';
import { Shield, Store, Users, Receipt, CheckCircle2, Building2, Plus, Edit3, Key, X, Save } from 'lucide-react';

export const SuperAdminView: React.FC = () => {
  const [shops, setShops] = useState<SubscriberShop[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit / Manage Subscription Modal
  const [editingShop, setEditingShop] = useState<SubscriberShop | null>(null);
  const [editPlan, setEditPlan] = useState('');
  const [editName, setEditName] = useState('');
  const [editOwner, setEditOwner] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [resetPassword, setResetPassword] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Add Shop Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPlan, setNewPlan] = useState('الباقة الماسية (سنوي)');
  const [newAdminUser, setNewAdminUser] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('123');
  const [savingNew, setSavingNew] = useState(false);

  const loadData = () => {
    setLoading(true);
    fetchSubscriberShops().then((data) => {
      setShops(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenEdit = (shop: SubscriberShop) => {
    setEditingShop(shop);
    setEditName(shop.name);
    setEditOwner(shop.owner_name);
    setEditPhone(shop.phone);
    setEditAddress(shop.address);
    setEditPlan(shop.subscription_plan);
    setEditIsActive(shop.is_active);
    setResetPassword('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShop) return;
    setSavingEdit(true);

    const ok = await adminUpdateShopAPI(editingShop.id, {
      name: editName,
      owner_name: editOwner,
      phone: editPhone,
      address: editAddress,
      subscription_plan: editPlan,
      is_active: editIsActive,
      owner_new_password: resetPassword || undefined,
    });

    setSavingEdit(false);
    if (ok) {
      setEditingShop(null);
      loadData();
    }
  };

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newOwner || !newAdminUser || !newAdminPass) return;
    setSavingNew(true);

    const ok = await adminCreateShopAPI({
      name: newName,
      owner_name: newOwner,
      phone: newPhone,
      address: newAddress,
      subscription_plan: newPlan,
      admin_username: newAdminUser,
      admin_password: newAdminPass,
    });

    setSavingNew(false);
    if (ok) {
      setShowAddModal(false);
      setNewName('');
      setNewOwner('');
      setNewPhone('');
      setNewAddress('');
      setNewAdminUser('');
      loadData();
    } else {
      alert('حدث خطأ أثناء إضافة المحل، تأكد أن اسم المستخدم غير مكرر');
    }
  };

  const totalInvoices = shops.reduce((acc, s) => acc + s.total_invoices, 0);
  const totalStaff = shops.reduce((acc, s) => acc + s.total_staff, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Platform Welcome Header */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 p-6 rounded-3xl border border-indigo-900/40 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-lg">
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">لوحة تحكم سوبر أدمن المنصة السحابية</h2>
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] px-2.5 py-0.5 rounded-full font-mono">
                Platform Owner
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              إدارة اشتراكات محلات الصاغة والمجوهرات، كلمات المرور، وتفعيل الحسابات
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer shadow-lg shadow-indigo-600/30"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة محل صاغة جديد</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>إجمالي محلات الصاغة المشتركة:</span>
            <Store className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-100">{shops.length} محلات</div>
          <p className="text-[10px] text-emerald-400">جميع الاشتراكات مفعلة</p>
        </div>

        <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>إجمالي فواتير المنصة:</span>
            <Receipt className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-100">{totalInvoices.toLocaleString()} فاتورة</div>
          <p className="text-[10px] text-slate-400">تمت معالجتها عبر نظامك</p>
        </div>

        <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>المساعدين والمستخدمين المسجلين:</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-100">{totalStaff} مستخدم</div>
          <p className="text-[10px] text-slate-400">جواهرجية ومساعدو كاشير</p>
        </div>
      </div>

      {/* Subscribed Shops Table */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-md overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-400" />
            <span>قائمة محلات الصاغة المشتركة في المنصة</span>
          </h3>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">جاري تحميل بيانات المنصة...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-4">اسم المحل</th>
                  <th className="p-4">صاحب المحل</th>
                  <th className="p-4">اسم مستخدم الدخول</th>
                  <th className="p-4">رقم الهاتف</th>
                  <th className="p-4">باقة الاشتراك</th>
                  <th className="p-4">الفواتير</th>
                  <th className="p-4">حالة الحساب</th>
                  <th className="p-4 text-center">إدارة وتعديل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {shops.map((shop) => (
                  <tr key={shop.id} className="hover:bg-slate-800/40">
                    <td className="p-4 font-sans font-bold text-slate-100">{shop.name}</td>
                    <td className="p-4 font-sans text-slate-300">{shop.owner_name}</td>
                    <td className="p-4 text-amber-400 font-bold">{shop.owner_username || 'admin'}</td>
                    <td className="p-4 text-slate-300">{shop.phone}</td>
                    <td className="p-4 font-sans">
                      <span className="bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-[11px]">
                        {shop.subscription_plan}
                      </span>
                    </td>
                    <td className="p-4 text-slate-200 font-bold">{shop.total_invoices}</td>
                    <td className="p-4">
                      {shop.is_active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-sans text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>نشط ومفعل</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-400 font-sans text-xs">
                          <X className="w-3.5 h-3.5" />
                          <span>معطل / موقوف</span>
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleOpenEdit(shop)}
                        className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 px-3 py-1.5 rounded-lg text-xs font-sans transition cursor-pointer flex items-center gap-1.5 mx-auto"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>إدارة الاشتراك / كلمة المرور</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit / Subscription & Password Reset Modal */}
      {editingShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-indigo-900/50 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">إدارة اشتراك وبيانات {editingShop.name}</h3>
                  <p className="text-[10px] text-slate-400">تعديل الاشتراك وإعادة تعيين كلمة مرور صاحب المحل</p>
                </div>
              </div>
              <button onClick={() => setEditingShop(null)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">اسم المحل</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">صاحب المحل</label>
                  <input
                    type="text"
                    value={editOwner}
                    onChange={(e) => setEditOwner(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">باقة الاشتراك</label>
                  <select
                    value={editPlan}
                    onChange={(e) => setEditPlan(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-bold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="الباقة الماسية (سنوي)">الباقة الماسية (سنوي)</option>
                    <option value="باقة البريميوم (شهري)">باقة البريميوم (شهري)</option>
                    <option value="باقة تجريبية (14 يوم)">باقة تجريبية (14 يوم)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">العنوان</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Password Reset Feature */}
              <div className="bg-indigo-950/40 border border-indigo-500/30 p-3.5 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-indigo-300 font-bold">
                  <Key className="w-4 h-4 text-indigo-400" />
                  <span>إعادة تعيين كلمة مرور الجواهرجي (لو نسيها):</span>
                </div>
                <input
                  type="text"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="اتركها فارغة إن لم ترغب في التغيير، أو اكتب كلمة مرور جديدة"
                  className="w-full bg-slate-950 border border-indigo-500/40 rounded-xl px-3 py-2 font-mono text-amber-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-400"
                />
                <p className="text-[10px] text-slate-400">
                  اسم المستخدم لحساب صاحب المحل: <span className="font-mono text-amber-400 font-bold">{editingShop.owner_username || 'admin'}</span>
                </p>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-300 font-medium">حالة اشتراك المحل:</span>
                <button
                  type="button"
                  onClick={() => setEditIsActive(!editIsActive)}
                  className={`px-4 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                    editIsActive ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                  }`}
                >
                  {editIsActive ? 'مفعل ونشط' : 'معطل / موقوف'}
                </button>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingShop(null)}
                  className="px-4 py-2 text-slate-400 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2.5 rounded-xl transition cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>حفظ التعديلات وتطبيقها</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Shop Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-indigo-900/50 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                <span>إضافة محل صاغة مشترك جديد للمنصة</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateShop} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">اسم المحل</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="مجوهرات الفجر"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">اسم صاحب المحل</label>
                  <input
                    type="text"
                    value={newOwner}
                    onChange={(e) => setNewOwner(e.target.value)}
                    placeholder="الحاج كمال رضوان"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="010..."
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">باقة الاشتراك</label>
                  <select
                    value={newPlan}
                    onChange={(e) => setNewPlan(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-bold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="الباقة الماسية (سنوي)">الباقة الماسية (سنوي)</option>
                    <option value="باقة البريميوم (شهري)">باقة البريميوم (شهري)</option>
                    <option value="باقة تجريبية (14 يوم)">باقة تجريبية (14 يوم)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">العنوان والفرع</label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="شارع الصاغة، المنيا"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                <div>
                  <label className="block text-slate-400 mb-1">اسم مستخدم الدخول له</label>
                  <input
                    type="text"
                    value={newAdminUser}
                    onChange={(e) => setNewAdminUser(e.target.value)}
                    placeholder="fajr_admin"
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 font-mono text-amber-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">كلمة المرور الأولية</label>
                  <input
                    type="text"
                    value={newAdminPass}
                    onChange={(e) => setNewAdminPass(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
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
                  disabled={savingNew}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2 rounded-xl transition cursor-pointer"
                >
                  تفعيل واشتراك المحل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
