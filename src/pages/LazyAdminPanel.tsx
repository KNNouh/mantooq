import React, { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load admin panel for better performance
const AdminPanelV2 = React.lazy(() => import('./AdminPanelV2'));

const LazyAdminPanel = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Skeleton className="w-12 h-12 rounded-lg mx-auto" />
          <Skeleton className="w-48 h-6 mx-auto" />
          <Skeleton className="w-32 h-4 mx-auto" />
        </div>
      </div>
    }>
      <AdminPanelV2 />
    </Suspense>
  );
};

export default LazyAdminPanel;