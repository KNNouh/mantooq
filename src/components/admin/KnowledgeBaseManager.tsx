import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Trash2, FileText, Clock, CheckCircle, XCircle, AlertCircle, PlayCircle } from 'lucide-react';

interface KBFile {
  id: string;
  filename: string;
  status: string;
  created_at: string;
  storage_path: string;
  updated_at: string;
}

const KnowledgeBaseManager = () => {
  const [files, setFiles] = useState<KBFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalFiles: 0,
    activeFiles: 0,
    processingFiles: 0,
    failedFiles: 0,
    pendingFiles: 0
  });
  const { toast } = useToast();

  const fetchFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('kb_files')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching files:', error);
        toast({
          title: "Error",
          description: "Failed to fetch files",
          variant: "destructive",
        });
        return;
      }

      setFiles(data || []);
      
      // Calculate stats
      const totalFiles = data?.length || 0;
      const activeFiles = data?.filter(f => f.status === 'active').length || 0;
      const processingFiles = data?.filter(f => f.status === 'processing').length || 0;
      const failedFiles = data?.filter(f => f.status === 'failed').length || 0;
      const pendingFiles = data?.filter(f => f.status === 'pending').length || 0;

      setStats({
        totalFiles,
        activeFiles,
        processingFiles,
        failedFiles,
        pendingFiles
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();

    // Set up real-time subscription
    const channel = supabase
      .channel('kb-files-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kb_files'
        },
        () => {
          fetchFiles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDelete = async (fileId: string) => {
    setDeleting(fileId);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast({
          title: "Error",
          description: "You must be logged in",
          variant: "destructive",
        });
        return;
      }

      const response = await supabase.functions.invoke('delete-kb-file', {
        body: { fileId },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (response.error) {
        throw response.error;
      }

      toast({
        title: "Success",
        description: "File deleted successfully",
      });

      fetchFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleTriggerProcessing = async (fileId: string) => {
    setProcessing(fileId);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast({
          title: "Error",
          description: "You must be logged in",
          variant: "destructive",
        });
        return;
      }

      const response = await supabase.functions.invoke('trigger-file-processing', {
        body: { fileId },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (response.error) {
        throw response.error;
      }

      toast({
        title: "Success",
        description: "File processing triggered successfully. n8n workflow will handle the embedding and storage.",
      });

      fetchFiles();
    } catch (error) {
      console.error('Error triggering processing:', error);
      toast({
        title: "Error",
        description: "Failed to trigger processing",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-700 border-green-200';
      case 'processing':
        return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'failed':
        return 'bg-red-500/10 text-red-700 border-red-200';
      default:
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
    }
  };

  const canTriggerProcessing = (file: KBFile) => {
    return ['pending', 'failed'].includes(file.status);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Files</p>
                <p className="text-2xl font-bold">{stats.totalFiles}</p>
              </div>
              <FileText className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeFiles}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Processing</p>
                <p className="text-2xl font-bold text-blue-600">{stats.processingFiles}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendingFiles}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600">{stats.failedFiles}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
      </div>

      {/* Files List */}
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base Files</CardTitle>
          <CardDescription>
            Manage your uploaded files and trigger processing manually. Processing is handled by n8n workflows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No files uploaded yet</h3>
              <p className="text-muted-foreground">Upload your first file to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-4 flex-1">
                    {/* Status icon on the far left */}
                    {getStatusIcon(file.status)}
                    
                    {/* Filename as primary element */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold truncate text-foreground">{file.filename}</h3>
                      <p className="text-sm text-muted-foreground">Updated: {formatDate(file.updated_at)}</p>
                    </div>
                    
                    {/* Status badge and created date */}
                    <div className="flex items-center space-x-3 text-sm">
                      <span className="text-muted-foreground">Created: {formatDate(file.created_at)}</span>
                      <Badge className={getStatusColor(file.status)}>
                        {file.status}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    {canTriggerProcessing(file) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTriggerProcessing(file.id)}
                        disabled={processing === file.id}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        {processing === file.id ? (
                          <Clock className="w-4 h-4 animate-spin" />
                        ) : (
                          <PlayCircle className="w-4 h-4" />
                        )}
                        Process
                      </Button>
                    )}
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={deleting === file.id}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {deleting === file.id ? (
                            <Clock className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete File</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{file.filename}"? This action cannot be undone.
                            This will also delete all associated documents and processing logs.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(file.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default KnowledgeBaseManager;