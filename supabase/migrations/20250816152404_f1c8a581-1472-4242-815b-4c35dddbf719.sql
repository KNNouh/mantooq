-- Performance optimization indexes for conversations and messages
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_user_id_created_at ON public.conversations(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conversation_id_created_at ON public.messages(conversation_id, created_at ASC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles(user_id, role);

-- Performance optimization for documents table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_file_id ON public.documents(file_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_embedding_cosine ON public.documents USING hnsw (embedding vector_cosine_ops);

-- Add missing columns for better performance tracking
ALTER TABLE public.kb_files ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;
ALTER TABLE public.kb_files ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.kb_files ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.kb_files ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.kb_files ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;