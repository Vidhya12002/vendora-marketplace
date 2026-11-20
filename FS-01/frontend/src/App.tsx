import { useEffect, useState } from 'react';
import { req, setToken } from './api';
import { Logo } from './components/ui';
import Admin from './pages/Admin';
import Cart from './pages/Cart';
import Login from './pages/Login';
import Orders from './pages/Orders';
import Shop from './pages/Shop';
import Vendor from './pages/Vendor';

const TABS: Record<string, string[]> = {
  CUSTOMER: ['shop', 'cart', 'orders'],
  VENDOR: ['shop', 'vendor'],
  ADMIN: ['shop', 'admin'],
};

export default function App() {
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem('u') || 'null'));
  const [tab, setTab] = useState('shop');
  const [cartCount, setCartCount] = useState(0);
  const [menu, setMenu] = useState(false);

  const signOut = () => {
    localStorage.clear();
    setToken('');
    setUser(null);
    setTab('shop');
    setMenu(false);
  };

const refreshCart = () =>
  req('/cart')
    .then((cart) => {
      const quantities = Object.values(cart as Record<string, number>);
      const total = quantities.reduce(
        (sum, quantity) => sum + Number(quantity || 0),
        0
      );
      setCartCount(total);
    })
    .catch((e) => e.message.includes('sign in') && signOut());

  useEffect(() => {
    if (user?.role === 'CUSTOMER') refreshCart();
  }, [user]);

  const signIn = (u: any) => {
    localStorage.setItem('u', JSON.stringify(u));
    setUser(u);
  };

  if (!user) return <Login onAuth={signIn} />;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between px-4 py-3 sm:px-8">
          <Logo />
          <nav className="flex items-center gap-1 text-sm font-medium">
            {TABS[user.role].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative rounded-lg px-3 py-1.5 capitalize transition ${tab === t ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {t}
                {t === 'cart' && cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-xs font-bold text-slate-900">
                    {cartCount}
                  </span>
                )}
              </button>
            ))}

            <div className="relative ml-3">
              <button
                onClick={() => setMenu(!menu)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white"
              >
                {user.name[0].toUpperCase()}
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0" onClick={() => setMenu(false)} />
                  <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-slate-100 bg-white p-2 shadow-lg">
                    <div className="px-3 py-2">
                      <p className="text-sm font-semibold">{user.name}</p>
                      <span className="mt-1 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium capitalize text-indigo-700">
                        {user.role.toLowerCase()}
                      </span>
                    </div>
                    <button onClick={signOut} className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50">
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1800px] flex-1 px-4 py-8 sm:px-8">
        {tab === 'shop' && <Shop role={user.role} onCartChange={refreshCart} />}
        {tab === 'cart' && <Cart onCartChange={refreshCart} />}
        {tab === 'orders' && <Orders />}
        {tab === 'vendor' && <Vendor />}
        {tab === 'admin' && <Admin />}
      </main>

      <footer className="border-t border-slate-100 py-6 text-center text-xs text-slate-400">
        © Vendora Marketplace · Secure payments by Razorpay
      </footer>
    </div>
  );
}
