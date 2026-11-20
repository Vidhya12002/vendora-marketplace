import { useEffect, useState } from 'react';
import { openInvoice, req } from '../api';
import ReviewModal from '../components/ReviewModal';
import { cardCls, money, StatusPill } from '../components/ui';

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [reviewing, setReviewing] = useState<any>(null);

  useEffect(() => { req('/orders').then(setOrders); }, []);

  if (orders.length === 0) return <p className="py-16 text-center text-slate-500">You have no orders yet.</p>;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {orders.map((order) => (
        <div key={order.id} className={cardCls}>
          <div className="mb-3 flex items-center justify-between">
            <b>Order #{order.id}</b>
            <span className="flex items-center gap-3 text-sm">
              <b>{money(order.total)}</b>
              <button className="font-medium text-indigo-600 hover:underline" onClick={() => openInvoice(order.id)}>Invoice PDF</button>
            </span>
          </div>
          {order.items.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between border-t border-slate-100 py-2 text-sm">
              <span>{item.product.title} × {item.qty}</span>
              <span className="flex items-center gap-3">
                <StatusPill status={item.status} />
                <button className="font-medium text-violet-600 hover:underline" onClick={() => setReviewing(item.product)}>
                  Write a review
                </button>
              </span>
            </div>
          ))}
        </div>
      ))}
      {reviewing && <ReviewModal productId={reviewing.id} productTitle={reviewing.title} onClose={() => setReviewing(null)} />}
    </div>
  );
}
