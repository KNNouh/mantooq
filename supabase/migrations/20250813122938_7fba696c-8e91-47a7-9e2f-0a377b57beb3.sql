-- Create helper function for admin privileges and update RLS policies
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

-- Drop existing admin policies
DROP POLICY IF EXISTS "Super admins can read all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can delete user roles" ON public.user_roles;

-- Create new policies for super_admin access only
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