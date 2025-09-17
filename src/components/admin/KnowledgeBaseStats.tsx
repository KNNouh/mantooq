import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Database, Clock, TrendingUp } from 'lucide-react';
import { logger } from '@/components/ProductionLogger';

interface KBStats {
  totalFiles: number;
  activeFiles: number;
  failedFiles: number;
  processingFiles: number;
  pendingFiles: number;
  totalChunks: number;
}

export const KnowledgeBaseStats = () => {
  const [stats, setStats] = useState<KBStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      // Get file statistics - only use existing columns
      const { data: fileStats, error: fileError } = await supabase
        .from('kb_files')
        .select('status');

      if (fileError) throw fileError;

      // Get document count
      const { count: docCount, error: docError } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });

      if (docError) throw docError;

      // Calculate statistics
      const totalFiles = fileStats?.length || 0;
      const activeFiles = fileStats?.filter(f => f.status === 'active').length || 0;
      const failedFiles = fileStats?.filter(f => f.status === 'failed').length || 0;
      const processingFiles = fileStats?.filter(f => f.status === 'processing').length || 0;
      const pendingFiles = fileStats?.filter(f => f.status === 'pending').length || 0;

      setStats({
        totalFiles,
        activeFiles,
        failedFiles,
        processingFiles,
        pendingFiles,
        totalChunks: docCount || 0
      });

    } catch (error) {
      logger.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Only refresh on component mount, not on intervals
  }, []);

  if (loading || !stats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
              {stats.pendingFiles > 0 && (
                <Badge variant="outline" className="text-xs">
                  {stats.pendingFiles} pending
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
              Processed documents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalFiles > 0 
                ? Math.round((stats.activeFiles / stats.totalFiles) * 100)
                : 0
              }%
            </div>
            <p className="text-xs text-muted-foreground">
              Files processed successfully
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

            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.activeFiles}</div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{stats.processingFiles}</div>
                <div className="text-xs text-muted-foreground">Processing</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{stats.pendingFiles}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
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