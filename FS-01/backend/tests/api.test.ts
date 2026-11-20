// Start the API and seed first, then: npm test
import test from 'node:test'; import assert from 'node:assert';
const B = 'http://localhost:4000'; const post = (p: string, b: any, t = '') => fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(b) });
test('health', async () => assert.ok((await (await fetch(B + '/health')).json()).ok));
test('search returns products', async () => { const r = await (await fetch(B + '/products?q=phone&sort=price_asc')).json(); assert.ok(Array.isArray(r)); });
test('customer blocked from admin API', async () => { const { token } = await (await post('/auth/login', { email: 'customer@demo.com', password: 'password123' })).json();
  assert.equal((await fetch(B + '/admin/analytics', { headers: { Authorization: 'Bearer ' + token } })).status, 403); });
test('payment needs login', async () => assert.equal((await post('/payments/create', {})).status, 401));
test('vendor cannot upload without file', async () => { const { token } = await (await post('/auth/login', { email: 'vendor1@demo.com', password: 'password123' })).json();
  assert.equal((await fetch(B + '/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + token } })).status, 400); });
