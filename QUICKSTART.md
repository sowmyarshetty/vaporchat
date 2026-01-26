# 🚀 Quick Start - Vapor Chat with Supabase

## 1. Set Up Supabase (5 minutes)

1. **Create account**: https://supabase.com
2. **Create new project** → Wait for it to initialize
3. **Run SQL schema**:
   - Go to **SQL Editor** in Supabase dashboard
   - Open `supabase/schema.sql` from this project
   - Copy and paste into SQL Editor
   - Click **Run**
4. **Get API keys**:
   - Go to **Settings** → **API**
   - Copy: Project URL, `anon` key, `service_role` key

## 2. Configure Environment Variables

Create `.env.local` in project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxx
```

## 3. Install & Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## 4. Deploy to Vercel

1. Push code to GitHub
2. Go to https://vercel.com
3. Import your repository
4. Add environment variables (same as `.env.local`)
5. Deploy!

## ✅ Done!

Your app is now live on Vercel with real-time chat via Supabase! 🎉

---

**Need help?** See:
- `SUPABASE_SETUP.md` - Detailed Supabase setup
- `README-VERCEL.md` - Vercel deployment guide
- `MIGRATION_SUMMARY.md` - What changed from Socket.io
