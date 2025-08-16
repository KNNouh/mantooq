-- Performance optimization indexes for conversations and messages
CREATE INDEX IF NOT EXISTS idx_conversations_user_id_created_at ON public.conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at ON public.messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles(user_id, role);

-- Performance optimization for documents table
CREATE INDEX IF NOT EXISTS idx_documents_file_id ON public.documents(file_id);

-- Add missing columns for better performance tracking
ALTER TABLE public.kb_files ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;
ALTER TABLE public.kb_files ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.kb_files ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.kb_files ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.kb_files ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Add processing log table for better monitoring
CREATE TABLE IF NOT EXISTS public.processing_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID REFERENCES public.kb_files(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}',
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processing_log_file_id_created_at ON public.processing_log(file_id, created_at DESC);