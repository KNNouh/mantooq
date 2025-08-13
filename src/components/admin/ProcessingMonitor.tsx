import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ProcessingFile {
  id: string;
  filename: string;
  status: string;
  created_at: string;
  processing_started_at?: string;
  processing_completed_at?: string;
  error_message?: string;
  retry_count: number;
  file_size_bytes?: number;
  total_chunks: number;
  processed_chunks: number;
}

interface ProcessingLogEntry {
  id: string;
  stage: string;
  status: string;
  message: string;
  created_at: string;
  duration_ms?: number;
  metadata: any;
}

export const ProcessingMonitor = () => {
  const [files, setFiles] = useState<ProcessingFile[]>([]);
  const [logs, setLogs] = useState<ProcessingLogEntry[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
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
      console.error('Error fetching files:', error);
      toast({
        title: "Error",
        description: "Failed to fetch processing files",
        variant: "destructive",
      });
    }
  };

  const fetchLogs = async (fileId: string) => {
    try {
      const { data, error } = await supabase
        .from('processing_log')
        .select('*')
        .eq('file_id', fileId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast({
        title: "Error",
        description: "Failed to fetch processing logs",
        variant: "destructive",
      });
    }
  };

  const retryProcessing = async (fileId: string) => {
    try {
      const { error } = await supabase.functions.invoke('process-file-v2', {
        body: { fileId }
      });

      if (error) throw error;

      toast({
        title: "Processing Restarted",
        description: "File processing has been queued for retry",
      });

      // Refresh the files list
      fetchFiles();
    } catch (error) {
      console.error('Error retrying processing:', error);
      toast({
        title: "Error",
        description: "Failed to restart processing",
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

    // Set up real-time subscription for log updates
    const logSubscription = supabase
      .channel('processing_log_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'processing_log' },
        (payload) => {
          if (selectedFileId && (payload.new as any)?.file_id === selectedFileId) {
            fetchLogs(selectedFileId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(fileSubscription);
      supabase.removeChannel(logSubscription);
    };
  }, [selectedFileId]);

  useEffect(() => {
    if (selectedFileId) {
      fetchLogs(selectedFileId);
    }
  }, [selectedFileId]);

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

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    return `${Math.round(bytes / 1024)}KB`;
  };

  const formatDuration = (startTime?: string, endTime?: string) => {
    if (!startTime) return 'Not started';
    if (!endTime) return 'In progress...';
    
    const duration = new Date(endTime).getTime() - new Date(startTime).getTime();
    return `${Math.round(duration / 1000)}s`;
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Files List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Processing Files</CardTitle>
            <CardDescription>
              Monitor file processing status and progress
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
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedFileId === file.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedFileId(file.id)}
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
                    <div>Size: {formatFileSize(file.file_size_bytes)}</div>
                    <div>
                      Duration: {formatDuration(file.processing_started_at, file.processing_completed_at)}
                    </div>
                    {file.retry_count > 0 && (
                      <div className="text-yellow-600">
                        Retries: {file.retry_count}
                      </div>
                    )}
                  </div>

                  {/* Progress bar for processing files */}
                  {file.total_chunks > 0 && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span>{file.processed_chunks}/{file.total_chunks} chunks</span>
                      </div>
                      <Progress 
                        value={(file.processed_chunks / file.total_chunks) * 100} 
                        className="h-2"
                      />
                    </div>
                  )}

                  {file.error_message && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                      {file.error_message}
                    </div>
                  )}

                  {file.status === 'failed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        retryProcessing(file.id);
                      }}
                    >
                      Retry Processing
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Processing Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Processing Logs</CardTitle>
          <CardDescription>
            {selectedFileId 
              ? `Detailed logs for selected file`
              : 'Select a file to view processing logs'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            {selectedFileId ? (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 border rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{log.stage}</Badge>
                        <Badge className={getStatusColor(log.status)}>
                          {log.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                    
                    <div className="text-sm mb-2">{log.message}</div>
                    
                    {log.duration_ms && (
                      <div className="text-xs text-muted-foreground">
                        Duration: {log.duration_ms}ms
                      </div>
                    )}
                    
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs cursor-pointer text-muted-foreground">
                          Show metadata
                        </summary>
                        <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select a file to view processing logs
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};