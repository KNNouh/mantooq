-- Add super_admin to the app_role enum
ALTER TYPE public.app_role ADD VALUE 'super_admin';

-- Update the promote_user_to_admin function to UPDATE role instead of INSERT
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

-- Update the remove_admin_role function to revert to user role
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

-- Update has_role function to check for super_admin privileges as well
CREATE OR REPLACE FUNCTION public.has_admin_privileges(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'super_admin')
  );
$function$

-- Update RLS policies to use the new function for admin access
DROP POLICY IF EXISTS "Admins can read all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;

-- Create new policies for super_admin access
CREATE POLICY "Super admins can read all user roles" 
ON public.user_roles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can insert user roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete user roles" 
ON public.user_roles 
FOR DELETE 
USING (public.has_role(auth.uid(), 'super_admin'));