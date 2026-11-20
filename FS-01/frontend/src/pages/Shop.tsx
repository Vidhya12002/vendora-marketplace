import { useEffect, useState } from 'react';
import { req } from '../api';
import { btnCls, cardCls, inputCls, Modal, money, SearchIcon, Stars, useDialog } from '../components/ui';

type Props = { role: string; onCartChange: () => void };

const EMPTY = { q: '', category: '', min: '', max: '', sort: '' };
const SORTS = [
  ['', 'Best match'],
  ['price_asc', 'Price: low'],
  ['price_desc', 'Price: high'],
  ['rating', 'Top rated'],
];

export default function Shop({ role, onCartChange }: Props) {
  const { notify } = useDialog();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [filters, setFilters] = useState(EMPTY);
  const [reviews, setReviews] = useState<{ title: string; list: any[] } | null>(null);

  const load = (f = filters) => req('/products?' + new URLSearchParams(f)).then(setProducts);

  useEffect(() => {
    load();
    req('/categories').then(setCategories);
    req('/coupons').then(setCoupons).catch(() => {});
  }, []);

  // dropdown and sort pills apply instantly; text fields apply on Enter or when you leave the field
  const change = (key: string, value: string, instant = false) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    if (instant) load(next);
  };

  const clear = () => {
    setFilters(EMPTY);
    load(EMPTY);
  };

  const onEnter = (e: React.KeyboardEvent) => e.key === 'Enter' && load();

  const addToCart = async (id: number) => {
    try {
      const cart = await req('/cart');
      await req('/cart', 'POST', { productId: id, qty: (cart[id] || 0) + 1 });
      onCartChange();
    } catch (e: any) {
      notify(e.message, 'error');
    }
  };

  const showReviews = async (p: any) => setReviews({ title: p.title, list: await req(`/products/${p.id}/reviews`) });

  return (
    <div>
      <section className="mb-6 rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 p-6 text-white md:p-10">
        <h1 className="text-2xl font-bold md:text-4xl">Find something you will love</h1>
        <p className="mt-1 text-sm text-indigo-100">Thousands of products from independent sellers, one secure checkout.</p>
        <div className="mt-6 flex max-w-3xl items-center rounded-full bg-white p-1.5 shadow-lg">
          <span className="ml-4 text-slate-400"><SearchIcon /></span>
          <input
            className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none"
            placeholder="Search for products, brands or categories"
            value={filters.q}
            onChange={(e) => change('q', e.target.value)}
            onKeyDown={onEnter}
          />
          <button className="rounded-full bg-indigo-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-indigo-700" onClick={() => load()}>
            Search
          </button>
        </div>
        {coupons.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            {coupons.map((c) => (
              <span key={c.id} className="rounded-full border border-white/30 bg-white/10 px-3 py-1">
                Use code <b className="tracking-wide">{c.code}</b> for {c.percent}% off your whole order
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select className={inputCls + ' !w-auto !rounded-full'} value={filters.category} onChange={(e) => change('category', e.target.value, true)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500">
          ₹
          <input className="w-16 outline-none" placeholder="Min" value={filters.min} onChange={(e) => change('min', e.target.value)} onKeyDown={onEnter} onBlur={() => load()} />
          to
          <input className="w-16 outline-none" placeholder="Max" value={filters.max} onChange={(e) => change('max', e.target.value)} onKeyDown={onEnter} onBlur={() => load()} />
        </div>
        <div className="flex rounded-full border border-slate-200 bg-white p-1 text-sm md:ml-auto">
          {SORTS.map(([value, label]) => (
            <button
              key={value}
              onClick={() => change('sort', value, true)}
              className={`rounded-full px-3 py-1 transition ${filters.sort === value ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {JSON.stringify(filters) !== JSON.stringify(EMPTY) && (
          <button className="text-sm font-medium text-indigo-600 hover:underline" onClick={clear}>Clear filters</button>
        )}
      </div>

      {products.length === 0 && <p className="py-12 text-center text-slate-500">No products match your search.</p>}

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {products.map((p) => (
          <div key={p.id} className="group flex flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:shadow-md">
            <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 p-3">
              <img src={p.image} alt={p.title} className="h-32 w-full object-contain transition group-hover:scale-105" />
            </div>
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-indigo-500">{p.category}</p>
            <h3 className="line-clamp-2 text-sm font-semibold">{p.title}</h3>
            <button className="mt-1 flex items-center gap-1 text-left text-xs text-slate-500" onClick={() => showReviews(p)}>
              <Stars value={p.rating} />
              {p.reviewCount ? `${p.rating} (${p.reviewCount})` : 'No reviews'}
            </button>
            <div className="mt-auto flex items-center justify-between pt-3">
              <b className="text-lg">{money(p.price)}</b>
              {role === 'CUSTOMER' && (
                <button className={btnCls} disabled={p.stock < 1} onClick={() => addToCart(p.id)}>
                  {p.stock < 1 ? 'Sold out' : 'Add'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {reviews && (
        <Modal title={`Reviews: ${reviews.title}`} onClose={() => setReviews(null)}>
          <div className="max-h-72 space-y-3 overflow-y-auto">
            {reviews.list.length === 0 && <p className="text-sm text-slate-500">No reviews yet.</p>}
            {reviews.list.map((r) => (
              <div key={r.id} className="rounded-xl bg-slate-50 p-3">
                <Stars value={r.rating} />
                <p className="text-sm">{r.comment || 'No comment'}</p>
                <p className="mt-1 text-xs text-slate-400">by {r.user.name}</p>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
