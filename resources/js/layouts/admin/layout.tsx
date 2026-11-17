import AdminShell from '@/layouts/admin/admin-shell';
import { type PropsWithChildren } from 'react';

export default function AdminLayout({ children }: PropsWithChildren) {
  // When server-side rendering, we only render the layout on the client...
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    <AdminShell
      contentClassName="md:max-w-[52rem]"
      sectionClassName="md:max-w-[52rem]"
    >
      {children}
    </AdminShell>
  );
}
