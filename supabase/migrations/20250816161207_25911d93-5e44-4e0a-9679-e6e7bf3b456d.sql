-- Set replica identity for messages table
ALTER TABLE public.messages REPLICA IDENTITY FULL;