-- Drop existing admin policies and create super admin policies
DROP POLICY IF EXISTS "Super admins can read all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can insert user roles" ON public.user_roles;  
DROP POLICY IF EXISTS "Super admins can delete user roles" ON public.user_roles;

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