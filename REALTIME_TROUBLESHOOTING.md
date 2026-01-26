# Realtime Troubleshooting Guide

If messages only appear on refresh, the Realtime subscription isn't working. Follow these steps:

## Step 1: Enable Realtime in Supabase Dashboard

**This is the most common issue!**

1. Go to your Supabase project: https://app.supabase.com
2. Click **Database** → **Replication** (in left sidebar)
3. Find the **`messages`** table
4. Toggle **"Enable Realtime"** to **ON** ✅
5. Wait a few seconds for it to activate

## Step 2: Verify Realtime is Enabled via SQL

Run this in Supabase SQL Editor to check:

```sql
SELECT 
  schemaname, 
  tablename, 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'messages'
    ) THEN 'Enabled' 
    ELSE 'Disabled' 
  END as realtime_status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'messages';
```

If it shows "Disabled", run:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

## Step 3: Check Browser Console

1. Open your browser's Developer Tools (F12)
2. Go to **Console** tab
3. Look for:
   - `"Realtime subscription status: SUBSCRIBED"` ✅ (good!)
   - `"Realtime subscription status: TIMED_OUT"` ❌ (problem)
   - `"Realtime subscription error"` ❌ (problem)
   - `"New message received:"` ✅ (messages are coming through)

## Step 4: Check Network Tab

1. In Developer Tools, go to **Network** tab
2. Filter by **WS** (WebSocket)
3. Look for a connection to `wss://your-project.supabase.co/realtime/v1/websocket`
4. It should show status **101 Switching Protocols** ✅

## Step 5: Verify RLS Policies

Realtime requires RLS policies to allow reads. Run this in SQL Editor:

```sql
-- Check if policies exist
SELECT * FROM pg_policies 
WHERE tablename = 'messages' 
AND schemaname = 'public';
```

If no policies exist, run:

```sql
CREATE POLICY "Allow all on messages" ON messages 
FOR ALL USING (true) WITH CHECK (true);
```

## Step 6: Test Realtime Manually

Run this in Supabase SQL Editor to test:

```sql
-- Insert a test message (replace with your actual room_id)
INSERT INTO messages (room_id, sender_id, sender_name, content)
VALUES (
  'your-room-id-here',
  'test-sender-id',
  'Test User',
  'This is a test message'
);
```

If Realtime is working, you should see the message appear in your browser **without refreshing**.

## Common Issues

### Issue: "TIMED_OUT" status
- **Solution**: Check your network/firewall isn't blocking WebSocket connections
- Try refreshing the page
- Check if you're behind a corporate proxy

### Issue: No WebSocket connection
- **Solution**: 
  - Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct
  - Check browser console for connection errors
  - Try in an incognito window (to rule out extensions)

### Issue: Messages appear but delayed
- **Solution**: This might be normal (small delay). Check Supabase dashboard → Realtime → see if there are any errors

### Issue: Only your own messages appear
- **Solution**: This is likely an RLS policy issue. Ensure the policy allows SELECT operations

## Still Not Working?

1. **Check Supabase Status**: https://status.supabase.com
2. **Check Supabase Logs**: Dashboard → Logs → Realtime Logs
3. **Try a different browser** (to rule out browser issues)
4. **Check if Realtime is enabled for your Supabase plan** (free tier supports it)

## Quick Test

After enabling Realtime, open the app in **two different browser windows**:
1. Create a room in Window 1
2. Join the room in Window 2 (using the link)
3. Send a message from Window 1
4. It should appear **instantly** in Window 2 without refresh ✅
