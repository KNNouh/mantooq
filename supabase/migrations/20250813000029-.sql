-- Create function to handle new user role assignment
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically assign 'user' role to new signups
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically assign roles on user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to promote user to admin (only callable by existing admins)
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(target_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Check if current user is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can promote users';
  END IF;
  
  -- Insert admin role for target user (or update if exists)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to remove admin role
CREATE OR REPLACE FUNCTION public.remove_admin_role(target_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Check if current user is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can remove admin roles';
  END IF;
  
  -- Don't allow removing your own admin role if you're the only admin
  IF target_user_id = auth.uid() AND (
    SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin'
  ) = 1 THEN
    RAISE EXCEPTION 'Cannot remove the last admin';
  END IF;
  
  -- Remove admin role
  DELETE FROM public.user_roles 
  WHERE user_id = target_user_id AND role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bootstrap first admin - manually assign admin role to your user ID
-- Replace with your actual user ID from the auth logs
INSERT INTO public.user_roles (user_id, role)
VALUES ('2bec6bfc-c446-445b-ae5d-af625cce69c2', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;