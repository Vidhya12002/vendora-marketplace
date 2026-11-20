import { createContext, ReactNode, useContext, useState } from 'react';

/* ---------- Shared styles ---------- */
export const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition ' +
  'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
export const btnCls =
  'rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white ' +
  'shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';
export const ghostCls =
  'rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 ' +
  'transition hover:bg-slate-50';
export const cardCls = 'rounded-2xl border border-slate-100 bg-white p-5 shadow-sm';
export const money = (n: number) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/* ---------- Brand logo ---------- */
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="34" y2="34">
            <stop stopColor="#6366f1" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <rect width="34" height="34" rx="10" fill={light ? '#fff' : 'url(#lg)'} />
        <path
          d="M9 11l8 13 8-13"
          stroke={light ? '#6366f1' : '#fff'}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="25" cy="9" r="2.5" fill="#fbbf24" />
      </svg>
      <span className={`text-xl font-bold tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}>
        Vendora
      </span>
    </div>
  );
}

/* ---------- Rating stars (read-only or clickable) ---------- */
export function Stars({ value, onChange, size = 'text-base' }: { value: number; onChange?: (n: number) => void; size?: string }) {
  return (
    <span className={size}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          onClick={() => onChange?.(n)}
          className={`${n <= Math.round(value) ? 'text-amber-400' : 'text-slate-300'} ${onChange ? 'cursor-pointer' : ''}`}
        >
          ★
        </span>
      ))}
    </span>
  );
}

/* ---------- Order status pill ---------- */
const STATUS: Record<string, string> = {
  PLACED: 'bg-amber-50 text-amber-700',
  PACKED: 'bg-sky-50 text-sky-700',
  SHIPPED: 'bg-indigo-50 text-indigo-700',
  DELIVERED: 'bg-emerald-50 text-emerald-700',
};
export const StatusPill = ({ status }: { status: string }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[status]}`}>{status}</span>
);

/* ---------- The one common modal ---------- */
export function Modal({ title, onClose, children }: { title?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {title && <h3 className="mb-3 text-lg font-semibold">{title}</h3>}
        {children}
      </div>
    </div>
  );
}

/* ---------- Message / confirm dialogs: notify() and confirm() replace alert() ---------- */
type Kind = 'success' | 'error' | 'info';
type Dialog = { message: string; kind: Kind; ask: boolean; done: (ok: boolean) => void };
type Api = { notify: (message: string, kind?: Kind) => Promise<void>; confirm: (message: string) => Promise<boolean> };

const DialogContext = createContext<Api>(null as unknown as Api);
export const useDialog = () => useContext(DialogContext);

const ICON: Record<Kind, { symbol: string; cls: string; title: string }> = {
  success: { symbol: '✓', cls: 'bg-emerald-100 text-emerald-600', title: 'Success' },
  error: { symbol: '!', cls: 'bg-rose-100 text-rose-600', title: 'Something went wrong' },
  info: { symbol: '?', cls: 'bg-indigo-100 text-indigo-600', title: 'Please confirm' },
};

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const open = (message: string, kind: Kind, ask: boolean) =>
    new Promise<boolean>((resolve) =>
      setDialog({ message, kind, ask, done: (ok) => (setDialog(null), resolve(ok)) }),
    );

  const api: Api = {
    notify: (message, kind = 'info') => open(message, kind === 'info' ? 'info' : kind, false).then(() => {}),
    confirm: (message) => open(message, 'info', true),
  };
  const icon = dialog && ICON[dialog.ask ? 'info' : dialog.kind];

  return (
    <DialogContext.Provider value={api}>
      {children}
      {dialog && icon && (
        <Modal onClose={() => dialog.done(false)}>
          <div className="text-center">
            <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold ${icon.cls}`}>
              {icon.symbol}
            </div>
            <h3 className="text-lg font-semibold">{dialog.ask ? 'Please confirm' : dialog.kind === 'info' ? 'Notice' : icon.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{dialog.message}</p>
            <div className="mt-5 flex justify-center gap-2">
              {dialog.ask && <button className={ghostCls} onClick={() => dialog.done(false)}>Cancel</button>}
              <button className={btnCls} onClick={() => dialog.done(true)}>{dialog.ask ? 'Confirm' : 'OK'}</button>
            </div>
          </div>
        </Modal>
      )}
    </DialogContext.Provider>
  );
}

/* ---------- Form helpers: labels with a red * for required fields ---------- */
export function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label}
        {required ? <span className="ml-0.5 text-rose-500">*</span> : <span className="ml-1 font-normal text-slate-400">(optional)</span>}
      </span>
      {children}
    </label>
  );
}

/** Returns one plain sentence naming the empty required fields, or '' when all are filled. */
export function missing(fields: [string, unknown][]) {
  const names = fields.filter(([, v]) => !String(v ?? '').trim()).map(([label]) => label);
  return names.length ? `Please fill in: ${names.join(', ')}.` : '';
}

export const FormError = ({ text }: { text: string }) =>
  text ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{text}</p> : null;

/* ---------- Icons ---------- */
const svg = { width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
export const SearchIcon = () => <svg viewBox="0 0 24 24" {...svg}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>;
export const EyeIcon = ({ off }: { off?: boolean }) => (
  <svg viewBox="0 0 24 24" {...svg}>
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" /><circle cx="12" cy="12" r="3" />
    {off && <path d="M3 3l18 18" />}
  </svg>
);
export const UploadIcon = () => <svg viewBox="0 0 24 24" {...svg} width={26} height={26}><path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></svg>;

/* ---------- Password box with show / hide eye ---------- */
export function PasswordInput(props: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        className={inputCls + ' pr-10'}
        type={show ? 'text' : 'password'}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
      <button
        type="button"
        title={show ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600"
        onClick={() => setShow(!show)}
      >
        <EyeIcon off={show} />
      </button>
    </div>
  );
}

/* ---------- Image upload drop area ---------- */
export function FileDrop({ image, busy, onFile }: { image?: string; busy?: boolean; onFile: (f?: File) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 transition hover:border-indigo-400 hover:bg-indigo-50">
      {image ? (
        <img src={image} className="h-14 w-14 rounded-xl bg-white object-contain" />
      ) : (
        <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-white text-indigo-500"><UploadIcon /></span>
      )}
      <span className="text-sm">
        <b className="block text-indigo-700">{busy ? 'Uploading...' : image ? 'Image uploaded. Click to change' : 'Click to upload an image'}</b>
        <span className="text-xs text-slate-500">PNG or JPG, up to 5 MB</span>
      </span>
      <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
    </label>
  );
}
