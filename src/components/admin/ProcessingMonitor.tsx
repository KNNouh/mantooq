import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/components/ProductionLogger';

interface ProcessingFile {
  id: string;
  filename: string;
  status: string;
  created_at: string;
  updated_at: string;
  storage_path: string;
}

export const ProcessingMonitor = () => {
  const [files, setFiles] = useState<ProcessingFile[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('kb_files')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      logger.error('Error fetching files:', error);
      toast({
        title: "Error",
        description: "Failed to fetch processing files",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchFiles();
    setLoading(false);

    // Set up real-time subscription for file updates
    const fileSubscription = supabase
      .channel('kb_files_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'kb_files' },
        () => {
          fetchFiles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(fileSubscription);
    };
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading processing status...</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Processing Files</CardTitle>
          <CardDescription>
            Monitor file processing status
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchFiles}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-3">
            {files.map((file) => (
              <div
                key={file.id}
                className="p-4 border rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(file.status)}
                    <span className="font-medium truncate">
                      {file.filename}
                    </span>
                  </div>
                  <Badge className={getStatusColor(file.status)}>
                    {file.status}
                  </Badge>
                </div>
                
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>Created: {new Date(file.created_at).toLocaleString()}</div>
                  <div>Updated: {new Date(file.updated_at).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};