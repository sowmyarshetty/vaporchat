-- Fix Realtime Binding Mismatch Error
-- Run this in Supabase SQL Editor if you get "mismatch between server and client bindings"
--
-- NOTE: The code has been updated to fix this error by removing the filter from
-- postgres_changes subscription and filtering in the callback instead.
-- This SQL fix is a backup solution if the code fix doesn't resolve the issue.

-- Step 1: Remove messages table from publication (if it exists)
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS messages;

-- Step 2: Add messages table back to publication
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Step 3: Verify it's added
SELECT 
  schemaname, 
  tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'messages';

-- If the query above returns a row, Realtime is properly configured!
-- Now enable it in the dashboard: Database → Replication → messages → Enable Realtime
--
-- Additional Steps:
-- 1. Make sure Realtime is enabled in Supabase Dashboard: Database → Replication → messages
-- 2. The code now filters messages by room_id in the callback instead of using a filter parameter
-- 3. This avoids binding mismatch errors while still receiving all relevant messages
