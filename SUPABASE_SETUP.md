# Supabase Setup Guide for Vapor Chat

## Step 1: Create Supabase Project

1. Go to https://supabase.com and sign up/login
2. Click **"New Project"**
3. Fill in:
   - **Name**: `vapor-chat` (or any name)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to you
4. Click **"Create new project"** (takes ~2 minutes)

## Step 2: Run Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **"New query"**
3. Copy the entire contents of `supabase/schema.sql`
4. Paste into the SQL editor
5. Click **"Run"** (or press `Ctrl+Enter`)
6. You should see "Success. No rows returned"

This creates:
- `rooms` table (room data with password hashes)
- `sessions` table (participants)
- `messages` table (chat messages)
- Indexes for performance
- Realtime subscriptions enabled

## Step 3: Get API Keys

1. In Supabase dashboard, go to **Settings** → **API**
2. Copy these values:

   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **Keep this secret!**

## Step 4: Configure Environment Variables

### For Local Development

1. Create `.env.local` in your project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

2. Restart your dev server: `npm run dev`

### For Vercel Deployment

1. Go to your Vercel project settings
2. Navigate to **Settings** → **Environment Variables**
3. Add all three variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Redeploy your app

## Step 5: Enable Realtime (Important!)

1. In Supabase dashboard, go to **Database** → **Replication**
2. Find the `messages` table
3. Toggle **"Enable Realtime"** to ON
4. Do the same for `sessions` table (optional, for future features)

Alternatively, the SQL schema already enables this, but verify it's enabled in the UI.

## Step 6: Test It!

1. Run `npm run dev`
2. Open http://localhost:3000
3. Create a room
4. Open the room link in another tab
5. Send messages - they should appear in real-time! 🎉

## Troubleshooting

### "Missing Supabase environment variables"
- Check `.env.local` exists and has all three variables
- Restart dev server after adding variables
- For Vercel: ensure variables are set in project settings

### "Room not found" or "Invalid session"
- Verify the SQL schema ran successfully
- Check Supabase dashboard → Table Editor → you should see `rooms`, `sessions`, `messages` tables

### Messages not appearing in real-time
- Go to Database → Replication → ensure `messages` has Realtime enabled
- Check browser console for WebSocket connection errors
- Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct

### "Failed to create room" / "Failed to join"
- Check `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Verify RLS policies allow operations (schema includes permissive policies)
- Check Supabase logs: Dashboard → Logs → API Logs

## Security Notes

- ⚠️ **Never commit `.env.local` or expose `SUPABASE_SERVICE_ROLE_KEY`**
- The service role key bypasses Row Level Security - keep it server-side only
- For production, consider tightening RLS policies in Supabase

## Next Steps

- Customize RLS policies for better security
- Add rate limiting
- Set up database backups in Supabase dashboard
- Monitor usage in Supabase dashboard → Usage
