-- Fix security warnings by adding search_path to functions
-- Update the two functions we just created to have secure search paths

DROP FUNCTION IF EXISTS public.validate_file_for_processing(UUID);
DROP FUNCTION IF EXISTS public.update_processing_progress(UUID, TEXT, TEXT, TEXT, JSONB, INTEGER);

-- Recreate with secure search paths
CREATE OR REPLACE FUNCTION public.validate_file_for_processing(p_file_id UUID)
RETURNS TABLE(
    is_valid BOOLEAN,
    error_message TEXT,
    file_info JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
SET search_path = ''
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