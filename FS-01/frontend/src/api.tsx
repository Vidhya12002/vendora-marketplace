export const API = import.meta.env.VITE_API || 'http://localhost:4000';
const OFFLINE = 'Cannot reach the server. Please check your connection and try again.';

let token = localStorage.getItem('t') || '';

export const setToken = (t: string) => {
  token = t;
  t ? localStorage.setItem('t', t) : localStorage.removeItem('t');
};

const authHeader = () => ({ Authorization: 'Bearer ' + token });

export async function req(path: string, method = 'GET', body?: unknown) {
  let res: Response;
  try {
    res = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(OFFLINE);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

export async function upload(file: File): Promise<string> {
  const form = new FormData();
  form.append('image', file);
  let res: Response;
  try {
    res = await fetch(API + '/upload', { method: 'POST', headers: authHeader(), body: form });
  } catch {
    throw new Error(OFFLINE);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Image upload failed. Please try again.');
  return data.url;
}

export async function openInvoice(orderId: number) {
  const res = await fetch(`${API}/orders/${orderId}/invoice`, { headers: authHeader() });
  window.open(URL.createObjectURL(await res.blob()));
}

export function loadRazorpay() {
  return new Promise<void>((done) => {
    if ((window as any).Razorpay) return done();
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => done();
    document.body.appendChild(script);
  });
}
