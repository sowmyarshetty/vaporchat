-- Fix Realtime Binding Mismatch Error
-- Run this in Supabase SQL Editor if you get "mismatch between server and client bindings"

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
