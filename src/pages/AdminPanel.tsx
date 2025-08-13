import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Upload, Edit, Trash2, FileText, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { AdminUpload } from '@/components/chat/AdminUpload';
import { UserManagement } from '@/components/admin/UserManagement';
import { useNavigate } from 'react-router-dom';

interface KBFile {
  id: string;
  filename: string;
  status: string;
  created_at: string;
  updated_at: string;
  file_md5: string;
  file_sha256: string;
  lang: string;
  storage_path: string;
}

const AdminPanel: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState<KBFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFile, setEditingFile] = useState<KBFile | null>(null);
  const [editForm, setEditForm] = useState({ filename: '', lang: '', status: '', newFile: null as File | null });
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (user && isAdmin) {
      loadFiles();
    }
  }, [user, isAdmin]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('kb_files')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error('Error loading files:', error);
      toast({
        title: 'Error',
        description: 'Failed to load files',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditFile = async () => {
    if (!editingFile) return;

    try {
      // If a new file is selected, replace the file in storage
      if (editForm.newFile) {
        // Delete the old file from storage
        const { error: deleteError } = await supabase.storage
          .from('kb-raw')
          .remove([editingFile.storage_path]);

        if (deleteError) {
          console.warn('Error deleting old file from storage:', deleteError);
        }

        // Upload the new file
        const fileExt = editForm.newFile.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('kb-raw')
          .upload(filePath, editForm.newFile);

        if (uploadError) throw uploadError;

        // Calculate file hashes
        const arrayBuffer = await editForm.newFile.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const sha256 = Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        // Update database with new file info
        const { error } = await supabase
          .from('kb_files')
          .update({
            filename: editForm.filename,
            lang: editForm.lang || null,
            status: 'pending', // Reset to pending for reprocessing
            storage_path: filePath,
            file_sha256: sha256,
            file_md5: null // Will be recalculated during processing
          })
          .eq('id', editingFile.id);

        if (error) throw error;
      } else {
        // Just update metadata
        const { error } = await supabase
          .from('kb_files')
          .update({
            filename: editForm.filename,
            lang: editForm.lang || null,
            status: editForm.status
          })
          .eq('id', editingFile.id);

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: editForm.newFile ? 'File replaced successfully' : 'File updated successfully'
      });

      setEditingFile(null);
      loadFiles();
    } catch (error) {
      console.error('Error updating file:', error);
      toast({
        title: 'Error',
        description: 'Failed to update file',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteFile = async (file: KBFile) => {
    try {
      // Delete from storage first
      const { error: storageError } = await supabase.storage
        .from('kb-raw')
        .remove([file.storage_path]);

      if (storageError) {
        console.warn('Storage deletion error:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('kb_files')
        .delete()
        .eq('id', file.id);

      if (dbError) throw dbError;

      toast({
        title: 'Success',
        description: 'File deleted successfully'
      });

      loadFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete file',
        variant: 'destructive'
      });
    }
  };

  const openEditDialog = (file: KBFile) => {
    setEditingFile(file);
    setEditForm({
      filename: file.filename,
      lang: file.lang || '',
      status: file.status,
      newFile: null
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      processing: 'secondary',
      active: 'default',
      failed: 'destructive',
      archived: 'outline'
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You need admin privileges to access this panel.</p>
            <Button 
              onClick={() => navigate('/')} 
              className="mt-4"
              variant="outline"
            >
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Chat
            </Button>
            <h1 className="text-3xl font-bold">Admin Panel</h1>
          </div>
          <Button
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {showUpload ? 'Hide Upload' : 'Upload File'}
          </Button>
        </div>

        <div className="space-y-6">
          {showUpload && (
            <Card>
              <CardHeader>
                <CardTitle>Upload New File</CardTitle>
              </CardHeader>
              <CardContent>
                <AdminUpload onFileUploaded={() => {
                  loadFiles();
                  setShowUpload(false);
                }} />
              </CardContent>
            </Card>
          )}

          <UserManagement onUserPromoted={() => {
            // Optionally refresh admin state or show notification
            toast({
              title: 'User Roles Updated',
              description: 'User roles have been updated successfully'
            });
          }} />

          <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Knowledge Base Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading files...</p>
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No files found. Upload your first file to get started!</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell className="font-medium">{file.filename}</TableCell>
                      <TableCell>{getStatusBadge(file.status)}</TableCell>
                      <TableCell>{file.lang || 'N/A'}</TableCell>
                      <TableCell>{new Date(file.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(file)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit File</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="filename">Filename</Label>
                                  <Input
                                    id="filename"
                                    value={editForm.filename}
                                    onChange={(e) => setEditForm({ ...editForm, filename: e.target.value })}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="lang">Language</Label>
                                  <Input
                                    id="lang"
                                    value={editForm.lang}
                                    onChange={(e) => setEditForm({ ...editForm, lang: e.target.value })}
                                    placeholder="e.g., en, ar, fr"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="status">Status</Label>
                                  <select
                                    id="status"
                                    value={editForm.status}
                                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                    className="w-full p-2 border rounded-md"
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="processing">Processing</option>
                                    <option value="active">Active</option>
                                    <option value="failed">Failed</option>
                                    <option value="archived">Archived</option>
                                  </select>
                                </div>
                                <div>
                                  <Label htmlFor="newFile">Replace File (Optional)</Label>
                                  <Input
                                    id="newFile"
                                    type="file"
                                    onChange={(e) => setEditForm({ ...editForm, newFile: e.target.files?.[0] || null })}
                                    className="cursor-pointer"
                                  />
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Leave empty to only update metadata
                                  </p>
                                </div>
                                <Button onClick={handleEditFile} className="w-full">
                                  Save Changes
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete File</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{file.filename}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteFile(file)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;