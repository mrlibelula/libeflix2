import AdminShell from '@/layouts/admin/admin-shell';
import { type PropsWithChildren } from 'react';

export default function AdminFullWidthLayout({ children }: PropsWithChildren) {
  // When server-side rendering, we only render the layout on the client...
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    <AdminShell
      wrapperClassName="max-w-full overflow-x-hidden"
      rowClassName="max-w-full"
      contentClassName="overflow-hidden max-w-full"
      sectionClassName="space-y-12 max-w-full"
    >
      {children}
    </AdminShell>
  );
}
