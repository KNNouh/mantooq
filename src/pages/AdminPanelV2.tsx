import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { UserManagement } from '@/components/admin/UserManagement';
import { AdminUpload } from '@/components/chat/AdminUpload';
import { ProcessingMonitor } from '@/components/admin/ProcessingMonitor';
import { KnowledgeBaseStats } from '@/components/admin/KnowledgeBaseStats';
import KnowledgeBaseManager from '@/components/admin/KnowledgeBaseManager';

const AdminPanelV2 = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('knowledge-base');

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
            <div>
              <h1 className="text-3xl font-bold">Enhanced Admin Panel</h1>
              <p className="text-muted-foreground">Manage your knowledge base and monitor processing</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="knowledge-base">Knowledge Base</TabsTrigger>
            <TabsTrigger value="files">File Management</TabsTrigger>
            <TabsTrigger value="processing">Processing Monitor</TabsTrigger>
            <TabsTrigger value="upload">File Upload</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
          </TabsList>

          <TabsContent value="knowledge-base" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Knowledge Base Overview</CardTitle>
                <CardDescription>
                  Monitor your knowledge base health and performance metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <KnowledgeBaseStats />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files" className="space-y-4">
            <KnowledgeBaseManager />
          </TabsContent>

          <TabsContent value="processing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Processing Monitor</CardTitle>
                <CardDescription>
                  Real-time monitoring of file processing status and detailed logs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProcessingMonitor />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="upload" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>File Upload</CardTitle>
                <CardDescription>
                  Upload new documents to your knowledge base
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdminUpload onFileUploaded={() => {
                  // Optionally switch to processing tab to monitor
                  setActiveTab('processing');
                }} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Manage user roles and permissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UserManagement />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPanelV2;