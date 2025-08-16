-- Enable replica identity for messages table to capture full row data for realtime
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Add messages table to realtime publication for real-time updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;