# Deploy (front end and back end separately)
## Backend on Render (Web Service)
Root directory `FS-01/backend` | Build: `npm install && npm run build && npx prisma migrate deploy` | Start: `npm start`
Add a Render PostgreSQL and set env: DATABASE_URL, JWT_SECRET, CORS_ORIGIN (your Vercel URL), PUBLIC_API_URL (your Render URL), RAZORPAY_KEY_ID/SECRET, S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.
REDIS_URL (Upstash/Render Redis) and ES_URL (Elastic Cloud/Bonsai) are optional; without them the app uses memory cache and PostgreSQL search.
Run the seed once from your own PC with DATABASE_URL pointing to the Render database: `npm run seed`.
## Frontend on Vercel
Root directory `FS-01/frontend` | Framework Vite | Build `npm run build` | Output `dist` | Env `VITE_API=https://<your-render-url>`
