import { FormEvent, useState } from 'react';
import { req, setToken } from '../api';
import { btnCls, Field, FormError, inputCls, Logo, missing, PasswordInput } from '../components/ui';

export default function Login({ onAuth }: { onAuth: (user: any) => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: '' });
  const [register, setRegister] = useState(false);
  const [error, setError] = useState('');
  const set = (key: string, value: string) => setForm({ ...form, [key]: value });

  const switchMode = () => {
    setRegister(!register);
    setError('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const required: [string, string][] = register
      ? [['Name', form.name], ['Email', form.email], ['Password', form.password], ['Account type', form.role]]
      : [['Email', form.email], ['Password', form.password]];
    const problem = missing(required);
    if (problem) return setError(problem);
    if (!form.email.includes('@')) return setError('Please enter a valid email address.');
    if (register && form.password.length < 6) return setError('Password must be at least 6 characters.');
    try {
      const data = await req(register ? '/auth/register' : '/auth/login', 'POST', form);
      setToken(data.token);
      onAuth(data.user);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-12 text-white lg:flex">
        <Logo light />
        <div>
          <h2 className="text-4xl font-bold leading-tight">Where independent sellers meet happy buyers.</h2>
          <p className="mt-4 max-w-md text-indigo-100">
            Open your shop, reach customers and get paid securely. Vendora handles checkout, payouts and invoices.
          </p>
        </div>
        <p className="text-sm text-indigo-200">© Vendora Marketplace</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} noValidate autoComplete="off" className="w-full max-w-sm space-y-4">
          <div className="mb-4 lg:hidden"><Logo /></div>
          <div>
            <h1 className="text-2xl font-bold">{register ? 'Create your account' : 'Welcome back'}</h1>
            <p className="text-sm text-slate-500">{register ? 'Join as a buyer or a seller.' : 'Sign in to continue.'}</p>
          </div>
          {register && (
            <Field label="Full name" required>
              <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
          )}
          <Field label="Email" required>
            <input className={inputCls} type="email" autoComplete="off" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="Password" required>
            <PasswordInput value={form.password} onChange={(v) => set('password', v)} />
          </Field>
          {register && (
            <Field label="Account type" required>
              <select className={inputCls} value={form.role} onChange={(e) => set('role', e.target.value)}>
                <option value="">Select one</option>
                <option value="CUSTOMER">I want to buy</option>
                <option value="VENDOR">I want to sell</option>
              </select>
            </Field>
          )}
          <FormError text={error} />
          <button className={btnCls + ' w-full py-2.5'}>{register ? 'Create account' : 'Sign in'}</button>
          <button type="button" className="w-full text-sm text-indigo-600 hover:underline" onClick={switchMode}>
            {register ? 'Already have an account? Sign in' : 'New to Vendora? Create an account'}
          </button>
        </form>
      </div>
    </div>
  );
}
