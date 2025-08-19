-- Fix remaining search_path vulnerabilities in all database functions

CREATE OR REPLACE FUNCTION public.validate_file_for_processing(p_file_id uuid)
 RETURNS TABLE(is_valid boolean, error_message text, file_info jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.update_processing_progress(p_file_id uuid, p_stage text, p_status text, p_message text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb, p_duration_ms integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.set_kb_file_status(p_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
begin
  if p_status not in ('pending','processing','active','archived','failed') then
    raise exception 'Invalid status: %', p_status;
  end if;
  update public.kb_files
     set status = p_status, updated_at = now()
   where id = p_id;
end; 
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  -- Automatically assign 'user' role to new signups
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_conversation_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
  -- Update conversation history with the new message
  UPDATE public.conversations 
  SET 
    conversation_history = COALESCE(conversation_history, '[]'::jsonb) || 
      jsonb_build_object(
        'role', NEW.role,
        'content', NEW.content,
        'timestamp', NEW.created_at
      ),
    updated_at = now()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_conversation_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
  -- Check if user already has 3 conversations
  IF (SELECT COUNT(*) FROM public.conversations WHERE user_id = NEW.user_id) >= 3 THEN
    RAISE EXCEPTION 'User cannot have more than 3 conversations. Please delete an existing conversation to create a new one.';
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.documents_compute_derived()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
declare
  v_file_id uuid;
  v_split_params text;
  v_norm text;
  v_hash_source text;
begin
  -- file_id from metadata
  v_file_id := nullif(new.metadata->>'file_id','')::uuid;
  new.file_id := v_file_id;

  -- article label from content
  new.article_no := public.extract_article_label(new.content);

  -- parameters for hashing
  v_split_params := new.metadata->>'split_params';
  v_norm         := new.metadata->>'norm';

  -- build and hash
  v_hash_source := public.build_hash_source(new.content, v_split_params, v_norm);
  new.hash := encode(digest(convert_to(v_hash_source,'UTF8'), 'sha256'), 'hex');

  -- full‑text vector
  new.ts := public.simple_tsv(new.content);

  return new;
end; 
$function$;

CREATE OR REPLACE FUNCTION public.documents_skip_duplicates()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
begin
  if new.file_id is not null
     and exists (
       select 1 from public.documents d
       where d.file_id = new.file_id
         and d.hash    = new.hash
     )
  then
    return null; -- silently skip duplicate
  end if;
  return new;
end; 
$function$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
begin new.updated_at = now(); return new; end; 
$function$;