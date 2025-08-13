-- Update the remove_admin_role function
CREATE OR REPLACE FUNCTION public.remove_admin_role(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if current user is super_admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only super admins can remove admin roles';
  END IF;
  
  -- Don't allow removing super_admin role from frontend
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = target_user_id AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Cannot remove super admin role from frontend';
  END IF;
  
  -- Remove admin role and add user role
  DELETE FROM public.user_roles 
  WHERE user_id = target_user_id AND role = 'admin';
  
  -- Add user role if no roles exist
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$function$