-- Update the promote_user_to_admin function
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if current user is super_admin (only super_admins can promote to admin)
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only super admins can promote users to admin';
  END IF;
  
  -- Update existing user role to admin (or insert if no role exists)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Remove user role if it exists (since we're changing to admin)
  DELETE FROM public.user_roles 
  WHERE user_id = target_user_id AND role = 'user';
END;
$function$