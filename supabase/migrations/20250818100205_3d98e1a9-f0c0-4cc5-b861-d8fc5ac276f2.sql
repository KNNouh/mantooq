-- Ensure proper REPLICA IDENTITY for real-time updates
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Add the messages table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;