import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

interface UserRoles {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  roles: string[];
}

interface OptimizedAuthReturn {
  user: User | null;
  loading: boolean;
  userRoles: UserRoles;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
}

// Cache for user roles to avoid repeated queries
const userRolesCache = new Map<string, { roles: UserRoles; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useOptimizedAuth(): OptimizedAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<UserRoles>({
    isAdmin: false,
    isSuperAdmin: false,
    roles: []
  });

  const checkUserRoles = useCallback(async (userId: string) => {
    // Check cache first
    const cached = userRolesCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setUserRoles(cached.roles);
      return;
    }

    try {
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      const roles = rolesData?.map(r => r.role) || [];
      const isAdmin = roles.includes('admin') || roles.includes('super_admin');
      const isSuperAdmin = roles.includes('super_admin');

      const userRolesData = { isAdmin, isSuperAdmin, roles };
      
      // Cache the result
      userRolesCache.set(userId, {
        roles: userRolesData,
        timestamp: Date.now()
      });
      
      setUserRoles(userRolesData);
    } catch (error) {
      console.error('Error checking user roles:', error);
      setUserRoles({ isAdmin: false, isSuperAdmin: false, roles: [] });
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted) {
          setUser(session?.user ?? null);
          
          if (session?.user) {
            await checkUserRoles(session.user.id);
          }
          
          setLoading(false);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (mounted) {
          setUser(session?.user ?? null);
          
          if (session?.user) {
            await checkUserRoles(session.user.id);
          } else {
            setUserRoles({ isAdmin: false, isSuperAdmin: false, roles: [] });
            // Clear cache on logout
            userRolesCache.clear();
          }
          
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [checkUserRoles]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await supabase.auth.signInWithPassword({ email, password });
    return result;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const result = await supabase.auth.signUp({ email, password });
    return result;
  }, []);

  const signOut = useCallback(async () => {
    userRolesCache.clear();
    await supabase.auth.signOut();
  }, []);

  const memoizedReturn = useMemo(() => ({
    user,
    loading,
    userRoles,
    signIn,
    signUp,
    signOut
  }), [user, loading, userRoles, signIn, signUp, signOut]);

  return memoizedReturn;
}