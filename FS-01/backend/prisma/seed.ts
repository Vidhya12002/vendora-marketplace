import { PrismaClient } from '@prisma/client'; import bcrypt from 'bcryptjs'; const p = new PrismaClient();
(async () => { const pw = await bcrypt.hash('password123', 10);
  const mk = (email: string, name: string, role: any) => p.user.upsert({ where: { email }, update: {}, create: { email, name, role, password: pw } });
  await mk('admin@demo.com', 'Admin', 'ADMIN'); await mk('customer@demo.com', 'Customer', 'CUSTOMER');
  const v = [await mk('vendor1@demo.com', 'Vendor One', 'VENDOR'), await mk('vendor2@demo.com', 'Vendor Two', 'VENDOR')];
  const { products } = await (await fetch('https://dummyjson.com/products?limit=40')).json();
  await p.product.createMany({ data: products.map((x: any, i: number) => ({ title: x.title, description: x.description, price: x.price, stock: x.stock, category: x.category, image: x.thumbnail, vendorId: v[i % 2].id })) });
  await p.coupon.upsert({ where: { code: 'SAVE10' }, update: {}, create: { code: 'SAVE10', percent: 10 } }); console.log('Seeded'); })();
