-- Add RLS policies for user_roles table to allow authenticated users to read their own roles
-- and admins to read all user roles

-- Policy for users to read their own roles
CREATE POLICY "Users can read their own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy for admins to read all user roles (needed for UserManagement component)
CREATE POLICY "Admins can read all user roles" 
ON public.user_roles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- Policy for admins to insert new user roles
CREATE POLICY "Admins can insert user roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy for admins to delete user roles
CREATE POLICY "Admins can delete user roles" 
ON public.user_roles 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'));