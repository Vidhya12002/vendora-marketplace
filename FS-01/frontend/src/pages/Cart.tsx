import { useEffect, useState } from 'react';
import { loadRazorpay, req } from '../api';
import { btnCls, cardCls, inputCls, money, useDialog } from '../components/ui';

export default function Cart({ onCartChange }: { onCartChange: () => void }) {
  const { notify } = useDialog();
  const [cart, setCart] = useState<any>({ rows: [], sub: 0, discount: 0, total: 0 });
  const [offers, setOffers] = useState<any[]>([]);
  const [coupon, setCoupon] = useState('');

  const load = (code = coupon) =>
    req('/cart/details?coupon=' + code)
      .then(setCart)
      .catch((e) => notify(e.message, 'error'));

  useEffect(() => {
    load('');
    req('/coupons').then(setOffers).catch(() => {});
  }, []);

  const setQty = async (productId: number, qty: number) => {
    await req('/cart', 'POST', { productId, qty });
    await load();
    onCartChange();
  };

  const apply = (code: string) => {
    setCoupon(code);
    load(code);
  };

  const pay = async () => {
    try {
      const order = await req('/payments/create', 'POST', { coupon });
      await loadRazorpay();
      new (window as any).Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: 'INR',
        name: 'Vendora',
        order_id: order.orderId,
        theme: { color: '#6366f1' },
        handler: async (payment: any) => {
          try {
            const placed = await req('/payments/verify', 'POST', { ...payment, coupon });
            notify(`Order #${placed.id} placed. You paid ${money(placed.total)}.`, 'success');
            load('');
            onCartChange();
          } catch (e: any) {
            notify(e.message, 'error');
          }
        },
      }).open();
    } catch (e: any) {
      notify(e.message, 'error');
    }
  };

  if (cart.rows.length === 0) return <p className="py-20 text-center text-slate-500">Your cart is empty.</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className={cardCls}>
        {cart.rows.map(({ product, qty }: any) => (
          <div key={product.id} className="flex items-center gap-4 border-b border-slate-100 py-3 last:border-0">
            <img src={product.image} className="h-16 w-16 rounded-xl bg-indigo-50 object-contain" />
            <div className="flex-1">
              <p className="text-sm font-semibold">{product.title}</p>
              <p className="text-sm text-slate-500">{money(product.price)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="h-8 w-8 rounded-lg bg-slate-100 font-bold" onClick={() => setQty(product.id, qty - 1)}>−</button>
              <span className="w-6 text-center text-sm font-semibold">{qty}</span>
              <button className="h-8 w-8 rounded-lg bg-slate-100 font-bold" onClick={() => setQty(product.id, qty + 1)}>+</button>
            </div>
            <b className="w-28 text-right">{money(product.price * qty)}</b>
          </div>
        ))}
      </div>

      <div className={cardCls + ' h-fit space-y-3'}>
        <h3 className="font-semibold">Order summary</h3>
        <div className="flex gap-2">
          <input className={inputCls} placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value)} />
          <button className="text-sm font-medium text-indigo-600" onClick={() => load()}>Apply</button>
        </div>
        {offers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {offers.map((o) => (
              <button key={o.id} onClick={() => apply(o.code)} className="rounded-full border border-dashed border-indigo-300 bg-indigo-50 px-3 py-1 text-xs text-indigo-700">
                {o.code}: {o.percent}% off whole order
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-between text-sm"><span>Subtotal</span><span>{money(cart.sub)}</span></div>
        <div className="flex justify-between text-sm text-emerald-600"><span>Discount</span><span>− {money(cart.discount)}</span></div>
        <div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span>{money(cart.total)}</span></div>
        <button className={btnCls + ' w-full py-2.5'} onClick={pay}>Pay with Razorpay</button>
      </div>
    </div>
  );
}
