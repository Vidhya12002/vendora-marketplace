import { useEffect, useState } from 'react';
import { req } from '../api';
import { btnCls, cardCls, Field, FormError, ghostCls, inputCls, missing, money, useDialog } from '../components/ui';

export default function Admin() {
  const { notify, confirm } = useDialog();
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [coupon, setCoupon] = useState({ code: '', percent: '' });
  const [error, setError] = useState('');

  const load = () => {
    req('/admin/analytics').then(setStats);
    req('/admin/users').then(setUsers);
    req('/coupons').then(setCoupons);
  };
  useEffect(load, []);

  const run = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      if (done) notify(done, 'success');
      load();
    } catch (e: any) {
      notify(e.message, 'error');
    }
  };

  const createCoupon = async () => {
    const problem = missing([['Code', coupon.code], ['Discount %', coupon.percent]]);
    if (problem) return setError(problem);
    try {
      await req('/coupons', 'POST', coupon);
      setCoupon({ code: '', percent: '' });
      setError('');
      notify('Coupon created. It now applies to the whole order for every customer.', 'success');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const removeUser = async (u: any) => {
    if (await confirm(`Remove ${u.name}? They will no longer be able to sign in. You can restore them later.`)) {
      run(() => req('/admin/users/' + u.id, 'DELETE'), `${u.name} has been removed.`);
    }
  };

  const tiles = stats && [
    ['Orders', stats.orders, 'border-indigo-500'],
    ['Users', stats.users, 'border-violet-500'],
    ['Revenue', money(stats.revenue), 'border-emerald-500'],
    ['Commission', money(stats.commission), 'border-amber-400'],
    ['Vendor payouts', money(stats.vendorPayouts), 'border-sky-500'],
  ];

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {tiles.map(([label, value, border]: any) => (
            <div key={label} className={`rounded-2xl border-t-4 bg-white p-4 shadow-sm ${border}`}>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-xl font-bold">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={cardCls}>
          <h2 className="mb-2 font-semibold">Users</h2>
          {users.length === 0 && <p className="text-sm text-slate-500">No customers or vendors yet.</p>}
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between border-t border-slate-100 py-2 text-sm">
              <span className={u.deletedAt ? 'opacity-50' : ''}>
                <b>{u.name}</b> <span className="text-slate-400">{u.email}</span>
                <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs capitalize text-indigo-700">{u.role.toLowerCase()}</span>
                {u.deletedAt && <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700">removed</span>}
              </span>
              {u.deletedAt ? (
                <button className="font-medium text-indigo-600" onClick={() => run(() => req(`/admin/users/${u.id}/restore`, 'POST'), `${u.name} has been restored.`)}>Restore</button>
              ) : (
                <button className="font-medium text-rose-600" onClick={() => removeUser(u)}>Remove</button>
              )}
            </div>
          ))}
        </section>

        <div className="space-y-6">
          <section className={cardCls + ' space-y-3'}>
            <h2 className="font-semibold">Coupons</h2>
            <p className="text-sm text-slate-500">A coupon gives a percentage off the customer's whole order, not a single product. Customers see active coupons on the shop page and in their cart.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Code" required><input className={inputCls} placeholder="WELCOME20" value={coupon.code} onChange={(e) => setCoupon({ ...coupon, code: e.target.value })} /></Field>
              <Field label="Discount %" required><input className={inputCls} type="number" min="1" max="90" value={coupon.percent} onChange={(e) => setCoupon({ ...coupon, percent: e.target.value })} /></Field>
            </div>
            <FormError text={error} />
            <button className={btnCls} onClick={createCoupon}>Create coupon</button>
            {coupons.map((c) => (
              <div key={c.id} className="flex items-center justify-between border-t border-slate-100 pt-2 text-sm">
                <span><b>{c.code}</b> · {c.percent}% off {!c.active && <span className="text-rose-600">(off)</span>}</span>
                <button className="font-medium text-indigo-600" onClick={() => run(() => req('/coupons/' + c.id, 'PATCH'), '')}>{c.active ? 'Turn off' : 'Turn on'}</button>
              </div>
            ))}
          </section>

          <section className={cardCls + ' space-y-3'}>
            <h2 className="font-semibold">Search maintenance</h2>
            <p className="text-sm text-slate-500">Products are searched through Elasticsearch. If search results look out of date, refresh the index to rebuild it from the database.</p>
            <button className={ghostCls} onClick={() => run(() => req('/admin/reindex', 'POST'), 'Search index refreshed.')}>Refresh search index</button>
          </section>
        </div>
      </div>
    </div>
  );
}
