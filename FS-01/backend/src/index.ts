import express from 'express'; import cors from 'cors'; import jwt from 'jsonwebtoken'; import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client'; import Redis from 'ioredis'; import PDFDocument from 'pdfkit';
import multer from 'multer'; import crypto from 'crypto'; import fs from 'fs'; import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'; import { Client as ES } from '@elastic/elasticsearch'; import Razorpay from 'razorpay';
const prisma = new PrismaClient(); export const app = express(); const E = process.env;
app.use(cors({ origin: E.CORS_ORIGIN ? E.CORS_ORIGIN.split(',') : true }), express.json()); app.use('/uploads', express.static('uploads'));
const SECRET = E.JWT_SECRET || 'dev'; const COMMISSION = Number(E.COMMISSION_PERCENT || 10);
const rzp = E.RAZORPAY_KEY_ID ? new Razorpay({ key_id: E.RAZORPAY_KEY_ID, key_secret: E.RAZORPAY_KEY_SECRET! }) : null;
const s3 = E.S3_BUCKET ? new S3Client({ region: E.AWS_REGION }) : null; const es = E.ES_URL ? new ES({ node: E.ES_URL }) : null;
const redis = E.REDIS_URL ? new Redis(E.REDIS_URL) : null; const mem = new Map<string, string>();
const cget = async (k: string) => (redis ? redis.get(k) : mem.get(k) ?? null);
const cset = async (k: string, v: string, ttl = 86400) => { redis ? await redis.set(k, v, 'EX', ttl) : mem.set(k, v); };
let pv = 0; // bumped on every product change so cached searches go stale
const auth = (...roles: string[]) => async (req: any, res: any, next: any) => {
  try { const u: any = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET);
    const row = await prisma.user.findUnique({ where: { id: u.id }, select: { deletedAt: true } });
    if (!row || row.deletedAt) return res.status(401).json({ error: 'Your session has ended. Please sign in again.' });
    if (roles.length && !roles.includes(u.role)) return res.status(403).json({ error: 'You do not have access to this.' }); req.user = u; next();
  } catch { res.status(401).json({ error: 'Please sign in to continue.' }); } };
const friendly = (e: any) => e.code === 'P2002' ? (String(e.meta?.target).includes('code') ? 'That coupon code already exists.' : 'An account with this email already exists.')
  : e.code?.startsWith?.('P') || /prisma/i.test(e.message || '') ? 'Something went wrong. Please try again.' : e.message;
const wrap = (f: any) => (req: any, res: any) => f(req, res).catch((e: any) => { console.error(`[${req.method} ${req.path}]`, e); res.status(400).json({ error: friendly(e) }); });
const sign = async (u: any) => { await cset('sess:' + u.id, u.role, 604800); return { token: jwt.sign({ id: u.id, role: u.role }, SECRET, { expiresIn: '7d' }), user: { id: u.id, name: u.name, role: u.role } }; };

// ---- Elasticsearch index (falls back to PostgreSQL search if ES is down)
const shape = (p: any) => { const { reviews = [], ...r } = p; return { ...r, reviewCount: reviews.length, rating: reviews.length ? +(reviews.reduce((s: number, x: any) => s + x.rating, 0) / reviews.length).toFixed(1) : 0 }; };
async function indexAll() { if (!es) return; try {
  if (await es.indices.exists({ index: 'products' })) await es.indices.delete({ index: 'products' });
  await es.indices.create({ index: 'products', mappings: { properties: { rating: { type: 'float' }, reviewCount: { type: 'integer' }, title: { type: 'text' }, description: { type: 'text' }, category: { type: 'keyword' }, price: { type: 'float' }, createdAt: { type: 'date' } } } } as any);
  const all = await prisma.product.findMany({ where: { vendor: { deletedAt: null } }, include: { reviews: true } });
  if (all.length) await es.bulk({ refresh: true, operations: all.flatMap((p) => [{ index: { _index: 'products', _id: String(p.id) } }, shape(p)]) } as any); console.log('Elasticsearch ready');
} catch { console.log('Elasticsearch unavailable, using PostgreSQL search'); } }
async function sync(id: number) { pv++; if (!es) return; try { const p = await prisma.product.findFirst({ where: { id, vendor: { deletedAt: null } }, include: { reviews: true } });
  if (p) await es.index({ index: 'products', id: String(id), document: shape(p), refresh: true }); else await es.delete({ index: 'products', id: String(id), refresh: true }, { ignore: [404] }); } catch {} }
indexAll();

// ---- Auth
app.post('/auth/register', wrap(async (req: any, res: any) => { const { email, password, name, role } = req.body;
  if (!email || !password || !name) throw new Error('Please fill in all the fields.'); if (String(password).length < 6) throw new Error('Password must be at least 6 characters.');
  const u = await prisma.user.create({ data: { email, name, password: await bcrypt.hash(password, 10), role: role === 'VENDOR' ? 'VENDOR' : 'CUSTOMER' } }); res.json(await sign(u)); }));
app.post('/auth/login', wrap(async (req: any, res: any) => { const u = await prisma.user.findUnique({ where: { email: req.body.email } });
  if (!u || !(await bcrypt.compare(req.body.password, u.password))) return res.status(401).json({ error: 'Incorrect email or password.' });
  if (u.deletedAt) return res.status(403).json({ error: 'This account has been deactivated.' }); res.json(await sign(u)); }));

// ---- Image upload to S3 (local /uploads folder if S3_BUCKET is not set)
const up = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
app.post('/upload', auth('VENDOR'), up.single('image'), wrap(async (req: any, res: any) => { const f = req.file; if (!f || !/^image\//.test(f.mimetype)) throw new Error('Choose an image file (max 5 MB)');
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(f.originalname)}`;
  if (s3) { await s3.send(new PutObjectCommand({ Bucket: E.S3_BUCKET!, Key: 'products/' + name, Body: f.buffer, ContentType: f.mimetype })); return res.json({ url: `https://${E.S3_BUCKET}.s3.${E.AWS_REGION}.amazonaws.com/products/${name}` }); }
  fs.mkdirSync('uploads', { recursive: true }); fs.writeFileSync('uploads/' + name, f.buffer); res.json({ url: `${E.PUBLIC_API_URL || 'http://localhost:4000'}/uploads/${name}` }); }));

// ---- Products: search (Elasticsearch) + vendor CRUD
app.get('/products', wrap(async (req: any, res: any) => { const { q = '', category, min, max, sort } = req.query as any; const key = 'ps:' + pv + JSON.stringify(req.query);
  const hit = await cget(key); if (hit) return res.json(JSON.parse(hit)); let out: any[];
  try { if (!es) throw 0; const filter: any[] = []; if (category) filter.push({ term: { category } }); if (min || max) filter.push({ range: { price: { gte: min ? +min : undefined, lte: max ? +max : undefined } } });
    const r: any = await es.search({ index: 'products', size: 100, query: { bool: { must: q ? [{ multi_match: { query: q, fields: ['title^3', 'category', 'description'], fuzziness: 'AUTO' } }] : [{ match_all: {} }], filter } },
      sort: sort === 'price_asc' ? [{ price: 'asc' }] : sort === 'price_desc' ? [{ price: 'desc' }] : sort === 'rating' ? [{ rating: { order: 'desc', unmapped_type: 'float' } }, { reviewCount: { order: 'desc', unmapped_type: 'integer' } }] : q ? ['_score'] : [{ createdAt: 'desc' }] } as any); out = r.hits.hits.map((h: any) => h._source);
  } catch { out = (await prisma.product.findMany({ where: { vendor: { deletedAt: null }, OR: q ? [{ title: { contains: q, mode: 'insensitive' } }, { category: { contains: q, mode: 'insensitive' } }] : undefined, category: category || undefined, price: { gte: min ? +min : undefined, lte: max ? +max : undefined } },
      orderBy: sort === 'price_asc' ? { price: 'asc' } : sort === 'price_desc' ? { price: 'desc' } : { createdAt: 'desc' }, include: { reviews: true } })).map(shape);
    if (sort === 'rating') out.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount); }
  await cset(key, JSON.stringify(out), 30); res.json(out); }));
app.get('/categories', wrap(async (_q: any, res: any) => res.json((await prisma.product.findMany({ distinct: ['category'], select: { category: true } })).map((c) => c.category))));
app.get('/vendor/products', auth('VENDOR'), wrap(async (req: any, res: any) => res.json(await prisma.product.findMany({ where: { vendorId: req.user.id }, orderBy: { id: 'desc' } }))));
app.post('/products', auth('VENDOR'), wrap(async (req: any, res: any) => { const { title, description, price, stock, category, image } = req.body;
  const p = await prisma.product.create({ data: { title, description: description || '', price: +price, stock: +stock, category, image, vendorId: req.user.id } }); await sync(p.id); res.json(p); }));
app.put('/products/:id', auth('VENDOR'), wrap(async (req: any, res: any) => { const d: any = {}; for (const k of ['title', 'description', 'category', 'image']) if (k in req.body) d[k] = req.body[k]; for (const k of ['price', 'stock']) if (k in req.body) d[k] = +req.body[k];
  const r = await prisma.product.updateMany({ where: { id: +req.params.id, vendorId: req.user.id }, data: d }); if (!r.count) throw new Error('Product not found'); await sync(+req.params.id); res.json(r); }));
app.delete('/products/:id', auth('VENDOR'), wrap(async (req: any, res: any) => { const id = +req.params.id; if (!(await prisma.product.findFirst({ where: { id, vendorId: req.user.id } }))) throw new Error('Product not found');
  if (await prisma.orderItem.count({ where: { productId: id } })) throw new Error('This product has orders and cannot be deleted. Set its stock to 0 instead.');
  await prisma.review.deleteMany({ where: { productId: id } }); await prisma.product.delete({ where: { id } }); await sync(id); res.json({ ok: true }); }));

// ---- Cart in Redis
app.get('/cart', auth(), wrap(async (req: any, res: any) => res.json(JSON.parse((await cget('cart:' + req.user.id)) || '{}'))));
app.post('/cart', auth(), wrap(async (req: any, res: any) => { const c = JSON.parse((await cget('cart:' + req.user.id)) || '{}'); const { productId, qty } = req.body;
  qty > 0 ? (c[productId] = qty) : delete c[productId]; await cset('cart:' + req.user.id, JSON.stringify(c)); res.json(c); }));
async function quote(userId: number, code?: string) { const cart = JSON.parse((await cget('cart:' + userId)) || '{}'); const ids = Object.keys(cart).map(Number); if (!ids.length) throw new Error('Cart is empty');
  const prods = await prisma.product.findMany({ where: { id: { in: ids } } }); let sub = 0;
  const items = prods.map((p) => { const qty = cart[p.id]; if (p.stock < qty) throw new Error(`${p.title} is out of stock`); const line = p.price * qty; sub += line; const commission = +((line * COMMISSION) / 100).toFixed(2);
    return { productId: p.id, vendorId: p.vendorId, qty, price: p.price, commission, vendorEarning: +(line - commission).toFixed(2) }; });
  const c = code ? await prisma.coupon.findFirst({ where: { code: code.trim().toUpperCase(), active: true } }) : null; if (code && !c) throw new Error('That coupon code is not valid.'); const discount = c ? +((sub * c.percent) / 100).toFixed(2) : 0;
  return { prods, items, sub, discount, total: +(sub - discount).toFixed(2), cart }; }
app.get('/cart/details', auth(), wrap(async (req: any, res: any) => { try { const q = await quote(req.user.id, req.query.coupon as string); res.json({ rows: q.prods.map((p) => ({ product: p, qty: q.cart[p.id] })), sub: q.sub, discount: q.discount, total: q.total }); } catch (e: any) { if (e.message === 'Cart is empty') return res.json({ rows: [], sub: 0, discount: 0, total: 0 }); throw e; } }));

// ---- Razorpay (test mode): create order, verify signature, place order, split commission
app.post('/payments/create', auth(), wrap(async (req: any, res: any) => { if (!rzp) throw new Error('Razorpay keys are missing in backend .env'); const q = await quote(req.user.id, req.body.coupon);
  const o: any = await rzp.orders.create({ amount: Math.round(q.total * 100), currency: 'INR', receipt: `u${req.user.id}_${Date.now()}` }); res.json({ orderId: o.id, amount: o.amount, keyId: E.RAZORPAY_KEY_ID }); }));
app.post('/payments/verify', auth(), wrap(async (req: any, res: any) => { const { razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: sig, coupon } = req.body; if (!rzp) throw new Error('Razorpay not configured');
  if (crypto.createHmac('sha256', E.RAZORPAY_KEY_SECRET!).update(`${oid}|${pid}`).digest('hex') !== sig) throw new Error('Payment verification failed');
  const dup = await prisma.order.findFirst({ where: { paymentRef: pid }, include: { items: true } }); if (dup) return res.json(dup);
  const q = await quote(req.user.id, coupon); const ro: any = await rzp.orders.fetch(oid); if (ro.amount !== Math.round(q.total * 100)) throw new Error('Cart changed after payment started');
  const order = await prisma.$transaction(async (tx) => { const o = await tx.order.create({ data: { customerId: req.user.id, total: q.total, discount: q.discount, paymentRef: pid, items: { create: q.items } }, include: { items: true } });
    for (const i of q.items) await tx.product.update({ where: { id: i.productId }, data: { stock: { decrement: i.qty } } }); return o; });
  await cset('cart:' + req.user.id, '{}'); q.items.forEach((i) => sync(i.productId));
  // Split: vendors with a linked Razorpay Route account get their earnings; platform keeps the commission (coupon discount is borne by the platform)
  const accts = await prisma.user.findMany({ where: { id: { in: [...new Set(q.items.map((i) => i.vendorId))] }, razorpayAccountId: { not: null } } });
  const transfers = accts.map((a) => ({ account: a.razorpayAccountId!, amount: Math.round(q.items.filter((i) => i.vendorId === a.id).reduce((s, i) => s + i.vendorEarning, 0) * 100), currency: 'INR' }));
  if (transfers.length) try { await (rzp as any).payments.transfer(pid, { transfers }); } catch (e: any) { console.log('Route transfer skipped:', e.message); }
  res.json(order); }));
app.patch('/me/payout-account', auth('VENDOR'), wrap(async (req: any, res: any) => { const id = String(req.body.accountId || '').trim(); if (id && !/^acc_\w+$/.test(id)) throw new Error('That is not a valid Razorpay account id. It starts with acc_.');
  await prisma.user.update({ where: { id: req.user.id }, data: { razorpayAccountId: id || null } }); res.json({ ok: true }); }));
app.get('/orders', auth(), wrap(async (req: any, res: any) => res.json(await prisma.order.findMany({ where: { customerId: req.user.id }, include: { items: { include: { product: true } } }, orderBy: { id: 'desc' } }))));

// ---- Order lifecycle: PLACED > PACKED > SHIPPED > DELIVERED (vendor moves own items)
const NEXT: any = { PLACED: 'PACKED', PACKED: 'SHIPPED', SHIPPED: 'DELIVERED' };
app.get('/vendor/orders', auth('VENDOR'), wrap(async (req: any, res: any) => res.json(await prisma.orderItem.findMany({ where: { vendorId: req.user.id }, include: { product: true }, orderBy: { id: 'desc' } }))));
app.patch('/items/:id/advance', auth('VENDOR'), wrap(async (req: any, res: any) => { const i = await prisma.orderItem.findUnique({ where: { id: +req.params.id } });
  if (!i || i.vendorId !== req.user.id) throw new Error('Not your item'); if (!NEXT[i.status]) throw new Error('Already delivered'); res.json(await prisma.orderItem.update({ where: { id: i.id }, data: { status: NEXT[i.status] } })); }));

// ---- Reviews, coupons, invoices, analytics
app.get('/products/:id/reviews', wrap(async (req: any, res: any) => res.json(await prisma.review.findMany({ where: { productId: +req.params.id }, include: { user: { select: { name: true } } } }))));
app.post('/products/:id/reviews', auth('CUSTOMER'), wrap(async (req: any, res: any) => { const bought = await prisma.orderItem.findFirst({ where: { productId: +req.params.id, order: { customerId: req.user.id } } });
  if (!bought) throw new Error('Only buyers can review'); const r = await prisma.review.create({ data: { rating: Math.min(5, Math.max(1, +req.body.rating || 5)), comment: req.body.comment || '', productId: +req.params.id, userId: req.user.id } }); await sync(+req.params.id); res.json(r); }));
app.post('/coupons', auth('ADMIN'), wrap(async (req: any, res: any) => res.json(await prisma.coupon.create({ data: { code: String(req.body.code || '').trim().toUpperCase(), percent: Math.min(90, Math.max(1, +req.body.percent || 0)) } }))));
app.get('/orders/:id/invoice', auth(), wrap(async (req: any, res: any) => {
  const o = await prisma.order.findUnique({ where: { id: +req.params.id }, include: { items: { include: { product: true } }, customer: true } });
  if (!o || (o.customerId !== req.user.id && req.user.role !== 'ADMIN')) throw new Error('Order not found.');
  const inr = (n: number) => 'Rs. ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const d = new PDFDocument({ size: 'A4', margin: 40 }); res.setHeader('Content-Type', 'application/pdf'); d.pipe(res);
  d.rect(0, 0, 595, 110).fill('#4f46e5');
  d.fillColor('#ffffff').font('Helvetica-Bold').fontSize(26).text('Vendora', 40, 38);
  d.font('Helvetica').fontSize(10).text('Marketplace for independent sellers', 40, 70);
  d.font('Helvetica-Bold').fontSize(22).text('INVOICE', 380, 38, { width: 175, align: 'right' });
  d.font('Helvetica').fontSize(10).text(`No. INV-${String(o.id).padStart(5, '0')}`, 380, 70, { width: 175, align: 'right' });
  d.fillColor('#6b7280').font('Helvetica-Bold').fontSize(9).text('BILLED TO', 40, 140).text('INVOICE DETAILS', 330, 140);
  d.fillColor('#111827').font('Helvetica-Bold').fontSize(12).text(o.customer.name, 40, 156);
  d.font('Helvetica').fontSize(10).fillColor('#6b7280').text(o.customer.email, 40, 174);
  d.fillColor('#111827').text(`Date: ${o.createdAt.toLocaleDateString('en-IN')}`, 330, 156).text(`Order: #${o.id}`, 330, 170).text(`Payment ref: ${o.paymentRef}`, 330, 184);
  let y = 230; d.rect(40, y, 515, 26).fill('#eef2ff');
  d.fillColor('#4338ca').font('Helvetica-Bold').fontSize(9).text('#', 50, y + 9).text('ITEM', 80, y + 9).text('QTY', 330, y + 9, { width: 40, align: 'right' })
    .text('PRICE', 380, y + 9, { width: 80, align: 'right' }).text('AMOUNT', 470, y + 9, { width: 75, align: 'right' });
  y += 36; d.font('Helvetica').fillColor('#111827').fontSize(10);
  o.items.forEach((i, n) => {
    d.fillColor('#111827').text(String(n + 1), 50, y).text(i.product.title, 80, y, { width: 240, height: 14, ellipsis: true }).text(String(i.qty), 330, y, { width: 40, align: 'right' })
      .text(inr(i.price), 380, y, { width: 80, align: 'right' }).text(inr(i.price * i.qty), 470, y, { width: 75, align: 'right' });
    y += 26; d.moveTo(40, y - 7).lineTo(555, y - 7).strokeColor('#e5e7eb').stroke(); });
  y += 10; const row = (l: string, v: string, bold = false) => { d.fillColor('#111827').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 13 : 10).text(l, 340, y, { width: 110 }).text(v, 450, y, { width: 95, align: 'right' }); y += bold ? 26 : 20; };
  row('Subtotal', inr(o.total + o.discount)); row('Discount', '- ' + inr(o.discount)); d.rect(335, y - 2, 220, 1.5).fill('#4f46e5'); y += 8; row('Total paid', inr(o.total), true);
  d.fillColor('#6b7280').font('Helvetica').fontSize(9).text('Thank you for shopping on Vendora. This is a computer-generated invoice and needs no signature.', 40, 770, { width: 515, align: 'center' });
  d.end(); }));
app.get('/admin/analytics', auth('ADMIN'), wrap(async (_q: any, res: any) => { const a = await prisma.orderItem.aggregate({ _sum: { commission: true, vendorEarning: true } }); const r = await prisma.order.aggregate({ _sum: { total: true } });
  const g = await prisma.orderItem.groupBy({ by: ['vendorId'], _sum: { vendorEarning: true, commission: true } }); const names = await prisma.user.findMany({ where: { id: { in: g.map((x) => x.vendorId) } } });
  const st = await prisma.orderItem.groupBy({ by: ['status'], _count: true });
  res.json({ orders: await prisma.order.count(), users: await prisma.user.count(), revenue: r._sum.total || 0, commission: a._sum.commission || 0, vendorPayouts: a._sum.vendorEarning || 0,
    byVendor: g.map((x) => ({ name: names.find((n) => n.id === x.vendorId)?.name, earned: x._sum.vendorEarning, commission: x._sum.commission })), byStatus: st.map((s) => ({ status: s.status, count: s._count })) }); }));
app.post('/admin/reindex', auth('ADMIN'), wrap(async (_q: any, res: any) => { await indexAll(); pv++; res.json({ ok: true }); }));
app.get('/coupons', auth(), wrap(async (req: any, res: any) => res.json(await prisma.coupon.findMany({ where: req.user.role === 'ADMIN' ? {} : { active: true }, orderBy: { id: 'desc' } }))));
app.patch('/coupons/:id', auth('ADMIN'), wrap(async (req: any, res: any) => { const c = await prisma.coupon.findUnique({ where: { id: +req.params.id } }); if (!c) throw new Error('Coupon not found.');
  res.json(await prisma.coupon.update({ where: { id: c.id }, data: { active: !c.active } })); }));
app.get('/me/payout-account', auth('VENDOR'), wrap(async (req: any, res: any) => res.json(await prisma.user.findUnique({ where: { id: req.user.id }, select: { razorpayAccountId: true } }))));
// Admin: users (soft delete = deletedAt is set; data is kept and the user can be restored)
app.get('/admin/users', auth('ADMIN'), wrap(async (_q: any, res: any) => res.json(await prisma.user.findMany({ where: { role: { not: 'ADMIN' } }, select: { id: true, name: true, email: true, role: true, deletedAt: true }, orderBy: { id: 'desc' } }))));
const setDeleted = (on: boolean) => wrap(async (req: any, res: any) => { const u = await prisma.user.findUnique({ where: { id: +req.params.id } }); if (!u || u.role === 'ADMIN') throw new Error('This account cannot be changed.');
  await prisma.user.update({ where: { id: u.id }, data: { deletedAt: on ? new Date() : null } });
  for (const p of await prisma.product.findMany({ where: { vendorId: u.id }, select: { id: true } })) await sync(p.id); res.json({ ok: true }); });
app.delete('/admin/users/:id', auth('ADMIN'), setDeleted(true)); app.post('/admin/users/:id/restore', auth('ADMIN'), setDeleted(false));
app.get('/health', (_q, r) => r.json({ ok: true, search: es ? 'elasticsearch' : 'postgres', cache: redis ? 'redis' : 'memory', storage: s3 ? 's3' : 'local' }));
if (require.main === module) app.listen(E.PORT || 4000, () => console.log('API on :' + (E.PORT || 4000)));
