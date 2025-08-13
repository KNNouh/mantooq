-- Fix search path issues for the new functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically assign 'user' role to new signups
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Fix promote user function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Fix remove admin function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';