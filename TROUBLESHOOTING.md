# Troubleshooting: Messages Not Showing

## Quick Checks

### 1. Check Browser Console
Open Developer Tools (F12) → Console tab. Look for:
- `"Loading messages for room: [roomId]"`
- `"Loaded messages: X"` (where X is the number)
- Any error messages in red

### 2. Verify RLS Policies
Run this in Supabase SQL Editor:

```sql
-- Check if policies exist
SELECT * FROM pg_policies 
WHERE tablename = 'messages' 
AND schemaname = 'public';
```

If no policies exist, run:

```sql
-- Drop existing if any
DROP POLICY IF EXISTS "Allow all on messages" ON messages;

-- Create policy
CREATE POLICY "Allow all on messages" ON messages 
FOR ALL USING (true) WITH CHECK (true);
```

### 3. Test Message Query Directly
Run this in Supabase SQL Editor (replace `your-room-id`):

```sql
SELECT * FROM messages 
WHERE room_id = 'your-room-id' 
ORDER BY sent_at ASC;
```

If this returns messages but the app doesn't, it's an RLS or client issue.

### 4. Check Environment Variables
Verify `.env.local` has correct values:
- `NEXT_PUBLIC_SUPABASE_URL` - should start with `https://`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - should be a long JWT token

### 5. Check Network Tab
1. Open Developer Tools → Network tab
2. Filter by "Fetch/XHR"
3. Look for requests to Supabase
4. Check if they return 200 OK or errors

### 6. Verify Realtime is Enabled
1. Supabase Dashboard → Database → Replication
2. Ensure `messages` table has "Enable Realtime" toggled ON

## Common Issues

### Issue: "new row violates row-level security policy"
**Solution**: RLS policies aren't set up correctly. Run the SQL schema again.

### Issue: Messages query returns empty array
**Possible causes**:
- No messages exist in the database
- RLS is blocking the query
- Wrong room_id

**Solution**: 
1. Check Supabase Table Editor → messages table
2. Verify messages exist for your room_id
3. Check RLS policies

### Issue: Messages load but don't display
**Solution**: Check browser console for React errors. The messages state might not be updating.

## Debug Steps

1. **Add temporary logging**:
   - The code now logs "Loading messages" and "Loaded messages: X"
   - Check browser console for these logs

2. **Test with a simple query**:
   ```javascript
   // In browser console on the room page
   const { data, error } = await supabase
     .from("messages")
     .select("*")
     .limit(5);
   console.log("Test query:", data, error);
   ```

3. **Check if messages state updates**:
   - Add `console.log("Messages state:", messages)` in the component
   - Or use React DevTools to inspect the component state

## Still Not Working?

1. **Check Supabase Logs**: Dashboard → Logs → API Logs
2. **Verify table structure**: Ensure columns match (room_id, sender_id, sender_name, content, sent_at)
3. **Test with a fresh room**: Create a new room and send a test message
