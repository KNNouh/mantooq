-- Enable real-time for chat_webhook_log table
ALTER TABLE public.chat_webhook_log REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_webhook_log;