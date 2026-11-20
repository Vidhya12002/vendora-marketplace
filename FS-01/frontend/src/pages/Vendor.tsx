import { useEffect, useState } from 'react';
import { req, upload } from '../api';
import { btnCls, cardCls, Field, FileDrop, FormError, ghostCls, inputCls, missing, money, StatusPill, useDialog } from '../components/ui';

const BLANK = { title: '', description: '', price: '', stock: '', category: '', image: '' };

export default function Vendor() {
  const { notify, confirm } = useDialog();
  const [form, setForm] = useState<any>(BLANK);
  const [editing, setEditing] = useState<number | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [linked, setLinked] = useState('');
  const [account, setAccount] = useState('');
  const [error, setError] = useState('');
  const [accountError, setAccountError] = useState('');
  const [uploading, setUploading] = useState(false);
  const set = (key: string, value: string) => setForm({ ...form, [key]: value });

  const load = () => {
    req('/vendor/products').then(setProducts);
    req('/vendor/orders').then(setItems);
    req('/me/payout-account').then((d) => setLinked(d.razorpayAccountId || ''));
  };
  useEffect(load, []);

  const pickImage = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      setForm({ ...form, image: await upload(file) });
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
    setUploading(false);
  };

  const save = async () => {
    const problem = missing([['Title', form.title], ['Price', form.price], ['Stock', form.stock], ['Category', form.category], ['Image', form.image]]);
    if (problem) return setError(problem);
    if (+form.price <= 0 || +form.stock < 0) return setError('Price must be above 0 and stock cannot be negative.');
    try {
      editing ? await req('/products/' + editing, 'PUT', form) : await req('/products', 'POST', form);
      notify(editing ? 'Product updated.' : 'Product added.', 'success');
      setForm(BLANK);
      setEditing(null);
      setError('');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const remove = async (id: number) => {
    if (!(await confirm('Delete this product? This cannot be undone.'))) return;
    try {
      await req('/products/' + id, 'DELETE');
      load();
    } catch (e: any) {
      notify(e.message, 'error');
    }
  };

  const startEdit = (p: any) => {
    setEditing(p.id);
    setError('');
    setForm({ title: p.title, description: p.description, price: p.price, stock: p.stock, category: p.category, image: p.image || '' });
    window.scrollTo(0, 0);
  };

  const saveAccount = async () => {
    try {
      await req('/me/payout-account', 'PATCH', { accountId: account });
      setAccountError('');
      notify(account ? 'Payout account saved.' : 'Payout account removed.', 'success');
      load();
    } catch (e: any) {
      setAccountError(e.message);
    }
  };

  const advance = async (id: number) => {
    try {
      await req(`/items/${id}/advance`, 'PATCH');
      load();
    } catch (e: any) {
      notify(e.message, 'error');
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className={cardCls}>
          <h2 className="mb-4 font-semibold">{editing ? 'Edit product' : 'Add a product'}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title" required><input className={inputCls} value={form.title} onChange={(e) => set('title', e.target.value)} /></Field>
            <Field label="Category" required><input className={inputCls} value={form.category} onChange={(e) => set('category', e.target.value)} /></Field>
            <Field label="Price (₹)" required><input className={inputCls} type="number" min="1" value={form.price} onChange={(e) => set('price', e.target.value)} /></Field>
            <Field label="Stock" required><input className={inputCls} type="number" min="0" value={form.stock} onChange={(e) => set('stock', e.target.value)} /></Field>
            <div className="md:col-span-2">
              <Field label="Description"><textarea className={inputCls} rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Product image" required><FileDrop image={form.image} busy={uploading} onFile={pickImage} /></Field>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <FormError text={error} />
            <div className="flex gap-2">
              <button className={btnCls} onClick={save}>{editing ? 'Save changes' : 'Add product'}</button>
              {editing && <button className={ghostCls} onClick={() => (setEditing(null), setForm(BLANK), setError(''))}>Cancel</button>}
            </div>
          </div>
        </section>

        <section className={cardCls}>
          <h2 className="mb-2 font-semibold">Your products</h2>
          {products.length === 0 && <p className="text-sm text-slate-500">You have not added any products yet.</p>}
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-t border-slate-100 py-2 text-sm">
              <span className="flex items-center gap-3">
                <img src={p.image} className="h-9 w-9 rounded-lg bg-indigo-50 object-contain" />
                {p.title} <span className="text-slate-400">{money(p.price)} · stock {p.stock}</span>
              </span>
              <span className="flex gap-4">
                <button className="font-medium text-indigo-600" onClick={() => startEdit(p)}>Edit</button>
                <button className="font-medium text-rose-600" onClick={() => remove(p.id)}>Delete</button>
              </span>
            </div>
          ))}
        </section>
      </div>

      <div className="space-y-6">
        <section className={cardCls}>
          <h2 className="mb-2 font-semibold">Orders to fulfil</h2>
          {items.length === 0 && <p className="text-sm text-slate-500">No orders yet.</p>}
          {items.map((i) => (
            <div key={i.id} className="border-t border-slate-100 py-2 text-sm">
              <p>{i.product.title} × {i.qty}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-slate-400">You earn {money(i.vendorEarning)}</span>
                <span className="flex items-center gap-3">
                  <StatusPill status={i.status} />
                  {i.status !== 'DELIVERED' && <button className="font-medium text-indigo-600" onClick={() => advance(i.id)}>Next step</button>}
                </span>
              </div>
            </div>
          ))}
        </section>

        <section className={cardCls + ' space-y-3'}>
          <h2 className="font-semibold">Payout account</h2>
          <p className="text-sm text-slate-500">
            Your earnings (sale price minus the platform commission) are always tracked here. To receive them automatically after each sale,
            add the Razorpay linked account id that the platform admin creates for you in Razorpay Route.
          </p>
          <p className={`rounded-lg px-3 py-2 text-sm ${linked ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {linked ? `Linked: ${linked}` : 'Not linked yet. Payouts will be handled manually.'}
          </p>
          <Field label="Razorpay account id" required>
            <input className={inputCls} placeholder="acc_XXXXXXXXXXXXXX" onChange={(e) => setAccount(e.target.value)} />
          </Field>
          <FormError text={accountError} />
          <button className={btnCls} onClick={saveAccount}>Save account</button>
        </section>
      </div>
    </div>
  );
}
