-- Fix Critical Security Issues

-- 1. Add UPDATE protection to user_roles table
CREATE POLICY "Block direct role updates" 
ON public.user_roles 
FOR UPDATE 
USING (false);

-- 2. Fix search_path vulnerabilities in database functions
CREATE OR REPLACE FUNCTION public.has_admin_privileges(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'super_admin')
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_users_with_roles()
 RETURNS TABLE(user_id uuid, email text, created_at timestamp with time zone, roles text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  -- Only allow super admins to call this function
  IF NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied. Super admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email::text,
    u.created_at,
    COALESCE(
      ARRAY_AGG(ur.role::text) FILTER (WHERE ur.role IS NOT NULL),
      ARRAY[]::text[]
    ) as roles
  FROM auth.users u
  LEFT JOIN public.user_roles ur ON u.id = ur.user_id
  GROUP BY u.id, u.email, u.created_at
  HAVING COUNT(ur.role) > 0 OR u.id = auth.uid()
  ORDER BY u.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.promote_user_to_admin(target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  -- Check if current user is super_admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only super admins can promote users to admin';
  END IF;
  
  -- Insert admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Remove user role if it exists
  DELETE FROM public.user_roles 
  WHERE user_id = target_user_id AND role = 'user';
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_admin_role(target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  -- Check if current user is super_admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only super admins can remove admin roles';
  END IF;
  
  -- Don't allow removing super_admin role
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = target_user_id AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Cannot remove super admin role from frontend';
  END IF;
  
  -- Remove admin role
  DELETE FROM public.user_roles 
  WHERE user_id = target_user_id AND role = 'admin';
  
  -- Add user role if no roles exist
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$function$;

-- 3. Add storage bucket RLS policies for kb-raw bucket
CREATE POLICY "Admins can view all files in kb-raw"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'kb-raw' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can upload to kb-raw"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'kb-raw' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can delete from kb-raw"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'kb-raw' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

-- 4. Create webhook configuration table for secure URL management
CREATE TABLE IF NOT EXISTS public.webhook_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  url text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on webhook_config
ALTER TABLE public.webhook_config ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage webhook configs
CREATE POLICY "Super admins can manage webhook config"
ON public.webhook_config
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

-- Insert default webhook configuration (to be updated by admin)
INSERT INTO public.webhook_config (name, url, is_active)
VALUES ('n8n_chat_webhook', 'https://hooks.zapier.com/hooks/catch/20734563/24yz9az/', true)
ON CONFLICT (name) DO NOTHING;

-- 5. Add trigger to prevent users from modifying their own roles
CREATE OR REPLACE FUNCTION public.prevent_self_role_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent users from modifying their own roles (except through proper functions)
  IF TG_OP = 'UPDATE' AND OLD.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Users cannot directly modify their own roles';
  END IF;
  
  -- Prevent direct role updates entirely (force use of proper functions)
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Role updates must be performed through proper administrative functions';
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER prevent_direct_role_updates
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_role_modification();

-- 6. Add file size and type validation function
CREATE OR REPLACE FUNCTION public.validate_file_upload()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate file size (100MB limit)
  IF NEW.file_size_bytes > 104857600 THEN
    RAISE EXCEPTION 'File size exceeds 100MB limit';
  END IF;
  
  -- Validate file extension
  IF NOT (NEW.filename ~* '\.(pdf|txt|md|docx)$') THEN
    RAISE EXCEPTION 'Invalid file type. Only PDF, TXT, MD, and DOCX files are allowed';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER validate_file_upload_trigger
  BEFORE INSERT OR UPDATE ON public.kb_files
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_file_upload();