import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Crown, UserMinus, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  roles: string[];
}

interface UserManagementProps {
  onUserPromoted?: () => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ onUserPromoted }) => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [demoting, setDemoting] = useState<string | null>(null);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [showAddAdmin, setShowAddAdmin] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // First get all users with their roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          role
        `);

      if (rolesError) throw rolesError;

      // Group roles by user
      const rolesByUser: Record<string, string[]> = {};
      userRoles?.forEach(ur => {
        if (!rolesByUser[ur.user_id]) {
          rolesByUser[ur.user_id] = [];
        }
        rolesByUser[ur.user_id].push(ur.role);
      });

      // Get unique user IDs
      const userIds = Object.keys(rolesByUser);
      
      // For each user, we need to simulate the user data since we can't query auth.users directly
      // We'll create a user list based on existing roles and any auth session info we have
      const usersWithRoles: UserWithRole[] = userIds.map(userId => ({
        id: userId,
        email: userId.includes('@') ? userId : 'user@example.com', // Fallback since we can't access auth.users
        created_at: new Date().toISOString(),
        roles: rolesByUser[userId] || []
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const promoteToAdmin = async (userId: string) => {
    try {
      setPromoting(userId);
      
      const { error } = await supabase.rpc('promote_user_to_admin', {
        target_user_id: userId
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'User promoted to admin successfully'
      });

      loadUsers();
      onUserPromoted?.();
    } catch (error: any) {
      console.error('Error promoting user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to promote user',
        variant: 'destructive'
      });
    } finally {
      setPromoting(null);
    }
  };

  const removeAdminRole = async (userId: string) => {
    try {
      setDemoting(userId);
      
      const { error } = await supabase.rpc('remove_admin_role', {
        target_user_id: userId
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Admin role removed successfully'
      });

      loadUsers();
      onUserPromoted?.();
    } catch (error: any) {
      console.error('Error removing admin role:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove admin role',
        variant: 'destructive'
      });
    } finally {
      setDemoting(null);
    }
  };

  const handleAddAdminByEmail = async () => {
    if (!newAdminEmail.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an email address',
        variant: 'destructive'
      });
      return;
    }

    // Note: In a real implementation, you'd need to look up the user by email
    // Since we can't query auth.users directly, we'll need the user ID
    toast({
      title: 'Info',
      description: 'To promote a user to admin, you need their User ID. Check the user_roles table or auth logs.',
      variant: 'default'
    });
    
    setNewAdminEmail('');
    setShowAddAdmin(false);
  };

  const isAdmin = (user: UserWithRole) => user.roles.includes('admin');

  const getRoleBadges = (roles: string[]) => {
    return roles.map(role => (
      <Badge 
        key={role} 
        variant={role === 'admin' ? 'default' : 'secondary'}
        className={role === 'admin' ? 'bg-yellow-500 text-yellow-900' : ''}
      >
        {role === 'admin' && <Crown className="w-3 h-3 mr-1" />}
        {role}
      </Badge>
    ));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5" />
            User Management
          </CardTitle>
          <Dialog open={showAddAdmin} onOpenChange={setShowAddAdmin}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Admin
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Admin User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="admin-email">User Email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="user@example.com"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Note: The user must have an existing account to be promoted to admin.
                  </p>
                </div>
                <Button onClick={handleAddAdminByEmail} className="w-full">
                  Promote to Admin
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No users found.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-mono text-xs">
                    {user.id.substring(0, 8)}...
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {getRoleBadges(user.roles)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {!isAdmin(user) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => promoteToAdmin(user.id)}
                          disabled={promoting === user.id}
                        >
                          <Crown className="w-4 h-4 mr-1" />
                          {promoting === user.id ? 'Promoting...' : 'Make Admin'}
                        </Button>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={demoting === user.id}
                            >
                              <UserMinus className="w-4 h-4 mr-1" />
                              Remove Admin
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Admin Role</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove admin privileges from this user? 
                                They will lose access to the admin panel and admin functions.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => removeAdminRole(user.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remove Admin
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};