import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Database, Clock, TrendingUp } from 'lucide-react';

interface KBStats {
  totalFiles: number;
  activeFiles: number;
  failedFiles: number;
  processingFiles: number;
  totalChunks: number;
  avgChunksPerFile: number;
  avgProcessingTime: number;
  totalStorageUsed: number;
}

export const KnowledgeBaseStats = () => {
  const [stats, setStats] = useState<KBStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      // Get file statistics
      const { data: fileStats, error: fileError } = await supabase
        .from('kb_files')
        .select('status, file_size_bytes, total_chunks, processing_started_at, processing_completed_at');

      if (fileError) throw fileError;

      // Get document count
      const { count: docCount, error: docError } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });

      if (docError) throw docError;

      // Calculate statistics
      const totalFiles = fileStats.length;
      const activeFiles = fileStats.filter(f => f.status === 'active').length;
      const failedFiles = fileStats.filter(f => f.status === 'failed').length;
      const processingFiles = fileStats.filter(f => f.status === 'processing').length;
      const totalStorageUsed = fileStats.reduce((sum, f) => sum + (f.file_size_bytes || 0), 0);
      
      const completedFiles = fileStats.filter(f => 
        f.processing_started_at && f.processing_completed_at
      );
      
      const avgProcessingTime = completedFiles.length > 0 
        ? completedFiles.reduce((sum, f) => {
            const duration = new Date(f.processing_completed_at!).getTime() - 
                           new Date(f.processing_started_at!).getTime();
            return sum + duration;
          }, 0) / completedFiles.length
        : 0;

      const totalChunks = fileStats.reduce((sum, f) => sum + (f.total_chunks || 0), 0);
      const avgChunksPerFile = totalFiles > 0 ? totalChunks / totalFiles : 0;

      setStats({
        totalFiles,
        activeFiles,
        failedFiles,
        processingFiles,
        totalChunks: docCount || 0,
        avgChunksPerFile,
        avgProcessingTime,
        totalStorageUsed
      });

    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  if (loading || !stats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted animate-pulse rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFiles}</div>
            <div className="flex gap-2 mt-2">
              <Badge variant="default" className="text-xs">
                {stats.activeFiles} active
              </Badge>
              {stats.failedFiles > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {stats.failedFiles} failed
                </Badge>
              )}
              {stats.processingFiles > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {stats.processingFiles} processing
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Knowledge Chunks</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalChunks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              ~{Math.round(stats.avgChunksPerFile)} avg per file
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(stats.totalStorageUsed)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalFiles > 0 && `~${formatBytes(stats.totalStorageUsed / stats.totalFiles)} avg per file`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avgProcessingTime > 0 ? formatDuration(stats.avgProcessingTime) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Per file completion
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base Health</CardTitle>
          <CardDescription>
            Overview of your knowledge base processing pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Processing Success Rate</span>
                <span>
                  {stats.totalFiles > 0 
                    ? Math.round((stats.activeFiles / stats.totalFiles) * 100)
                    : 0
                  }%
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{
                    width: stats.totalFiles > 0 
                      ? `${(stats.activeFiles / stats.totalFiles) * 100}%`
                      : '0%'
                  }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.activeFiles}</div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{stats.processingFiles}</div>
                <div className="text-xs text-muted-foreground">Processing</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{stats.failedFiles}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};