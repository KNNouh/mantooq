-- Phase 1: Database Schema Optimization

-- Add processing metrics and better status tracking to kb_files
ALTER TABLE public.kb_files ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.kb_files ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.kb_files ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.kb_files ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE public.kb_files ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;
ALTER TABLE public.kb_files ADD COLUMN IF NOT EXISTS total_chunks INTEGER DEFAULT 0;
ALTER TABLE public.kb_files ADD COLUMN IF NOT EXISTS processed_chunks INTEGER DEFAULT 0;

-- Add chunk-level tracking to documents table
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS chunk_index INTEGER;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS token_count INTEGER;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS chunk_source TEXT; -- 'pdf', 'text', 'docx'

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_documents_file_id ON public.documents(file_id);
CREATE INDEX IF NOT EXISTS idx_documents_embedding_hnsw ON public.documents USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_documents_ts_gin ON public.documents USING gin(ts);
CREATE INDEX IF NOT EXISTS idx_documents_hash ON public.documents(hash);
CREATE INDEX IF NOT EXISTS idx_kb_files_status ON public.kb_files(status);
CREATE INDEX IF NOT EXISTS idx_kb_files_created_at ON public.kb_files(created_at);

-- Create processing_log table for detailed tracking
CREATE TABLE IF NOT EXISTS public.processing_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES public.kb_files(id) ON DELETE CASCADE,
    stage TEXT NOT NULL, -- 'upload', 'validation', 'extraction', 'chunking', 'embedding', 'storage'
    status TEXT NOT NULL, -- 'started', 'completed', 'failed', 'retrying'
    message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    duration_ms INTEGER
);

-- Enable RLS on processing_log
ALTER TABLE public.processing_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for processing_log
CREATE POLICY "admin_all_processing_log" ON public.processing_log
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Add file type validation function
CREATE OR REPLACE FUNCTION public.validate_file_for_processing(p_file_id UUID)
RETURNS TABLE(
    is_valid BOOLEAN,
    error_message TEXT,
    file_info JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    file_rec RECORD;
    file_extension TEXT;
    max_size_bytes BIGINT := 100 * 1024 * 1024; -- 100MB limit
BEGIN
    -- Get file info
    SELECT * INTO file_rec FROM public.kb_files WHERE id = p_file_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'File not found', '{}'::jsonb;
        RETURN;
    END IF;
    
    -- Extract file extension
    file_extension := lower(split_part(file_rec.filename, '.', array_length(string_to_array(file_rec.filename, '.'), 1)));
    
    -- Check file size
    IF file_rec.file_size_bytes > max_size_bytes THEN
        RETURN QUERY SELECT FALSE, 'File too large (max 100MB)', 
            jsonb_build_object('size_bytes', file_rec.file_size_bytes, 'max_size_bytes', max_size_bytes);
        RETURN;
    END IF;
    
    -- Check supported file types
    IF file_extension NOT IN ('pdf', 'txt', 'md', 'docx') THEN
        RETURN QUERY SELECT FALSE, 'Unsupported file type: ' || file_extension, 
            jsonb_build_object('extension', file_extension, 'supported', ARRAY['pdf', 'txt', 'md', 'docx']);
        RETURN;
    END IF;
    
    -- All validations passed
    RETURN QUERY SELECT TRUE, 'File is valid for processing', 
        jsonb_build_object(
            'filename', file_rec.filename,
            'extension', file_extension,
            'size_bytes', file_rec.file_size_bytes,
            'status', file_rec.status
        );
END;
$$;

-- Function to update processing progress
CREATE OR REPLACE FUNCTION public.update_processing_progress(
    p_file_id UUID,
    p_stage TEXT,
    p_status TEXT,
    p_message TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_duration_ms INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert log entry
    INSERT INTO public.processing_log (file_id, stage, status, message, metadata, duration_ms)
    VALUES (p_file_id, p_stage, p_status, p_message, p_metadata, p_duration_ms);
    
    -- Update file record based on stage and status
    CASE
        WHEN p_stage = 'upload' AND p_status = 'completed' THEN
            UPDATE public.kb_files SET 
                status = 'uploaded',
                updated_at = now()
            WHERE id = p_file_id;
            
        WHEN p_stage = 'extraction' AND p_status = 'started' THEN
            UPDATE public.kb_files SET 
                status = 'processing',
                processing_started_at = now(),
                updated_at = now()
            WHERE id = p_file_id;
            
        WHEN p_stage = 'storage' AND p_status = 'completed' THEN
            UPDATE public.kb_files SET 
                status = 'active',
                processing_completed_at = now(),
                updated_at = now()
            WHERE id = p_file_id;
            
        WHEN p_status = 'failed' THEN
            UPDATE public.kb_files SET 
                status = 'failed',
                error_message = p_message,
                retry_count = retry_count + 1,
                updated_at = now()
            WHERE id = p_file_id;
            
        ELSE
            -- Just update the timestamp for other stages
            UPDATE public.kb_files SET updated_at = now() WHERE id = p_file_id;
    END CASE;
END;
$$;