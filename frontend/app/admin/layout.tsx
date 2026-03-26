'use client';

import AdminSidebar from '@/components/admin-dashboard/Sidebar';
import AdminTopbar from '@/components/admin-dashboard/Topbar';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { ClientErrorBoundary } from '@/components/error/ClientErrorBoundary';
import { useAuth } from '@/store/authStore';
import Link from 'next/link';
import AdminBreadcrumbs from '@/components/admin-dashboard/AdminBreadcrumbs';
import { getAdminPageTitle } from '@/components/admin-dashboard/navigation';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const pageTitle = getAdminPageTitle(pathname);
  const canAccessAdmin = ['admin', 'support', 'auditor'].includes(
    user?.role ?? '',
  );

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white overflow-x-hidden">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <AdminTopbar pageTitle={pageTitle} />
          <AdminBreadcrumbs pathname={pathname} />
          <ClientErrorBoundary
            source="app/admin/layout.tsx-main"
            fallbackTitle="Admin panel failed"
            fallbackDescription="This admin panel encountered an error. Retry to continue."
          >
            <main className="p-4 sm:p-6 overflow-auto flex-1">
              {!canAccessAdmin ? (
                <section className="mx-auto max-w-2xl rounded-3xl border border-amber-300/20 bg-amber-500/10 p-6 sm:p-8">
                  <h2 className="text-2xl font-bold text-amber-100">
                    Access restricted
                  </h2>
                  <p className="mt-3 text-sm sm:text-base text-amber-100/85">
                    Your account does not currently have permission to view
                    admin pages. Contact an administrator if you need access.
                  </p>
                  <Link
                    href="/"
                    className="mt-6 inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
                  >
                    Go to homepage
                  </Link>
                </section>
              ) : (
                children
              )}
            </main>
          </ClientErrorBoundary>
        </div>
      </div>
    </ProtectedRoute>
  );
}
