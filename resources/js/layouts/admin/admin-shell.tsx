import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState, type PropsWithChildren, type ReactNode } from 'react';

// In-memory only: every fresh arrive/reload starts expanded.
// Collapse still sticks while navigating between admin pages in the same session.
let adminNavCollapsedSession = false;

// Clear older persisted keys so a previous collapsed preference cannot stick.
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('admin_sidebar_collapsed');
    localStorage.removeItem('libeflix.admin_nav_collapsed');
  } catch {
    // ignore
  }
}

export const adminSidebarNavItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/admin/dashboard',
    icon: null,
  },
  {
    title: 'Users',
    href: '/admin/users',
    icon: null,
  },
  {
    title: 'Content Management',
    href: '/admin/content-management',
    icon: null,
  },
  {
    title: 'Subtitles',
    href: '/admin/subtitles',
    icon: null,
  },
  {
    title: 'FFMpeg Tasks',
    href: '/admin/ffmpeg-tasks',
    icon: null,
  },
  {
    title: 'Engagement',
    href: '/admin/engagement',
    icon: null,
  },
  {
    title: 'Search Engine Analytics',
    href: '/admin/search-engine',
    icon: null,
  },
  {
    title: 'Comments',
    href: '/admin/comments',
    icon: null,
  },
  {
    title: 'Error & Status Logs',
    href: '/admin/error-logs',
    icon: null,
  },
  {
    title: 'Storage Monitor',
    href: '/admin/storage-monitor',
    icon: null,
  },
  {
    title: 'Analytics',
    href: '/admin/analytics',
    icon: null,
  },
];

export function isAdminNavItemActive(currentPath: string, href: string) {
  if (currentPath === href) {
    return true;
  }

  if (href === '/admin/users' && currentPath.startsWith('/admin/users')) {
    return true;
  }

  if (href === '/admin/content-management' && currentPath.startsWith('/admin/content-management')) {
    return true;
  }

  if (href === '/admin/subtitles' && currentPath.startsWith('/admin/subtitles')) {
    return true;
  }

  return false;
}

function AdminNavLinks({
  currentPath,
  onNavigate,
  className,
}: {
  currentPath: string;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <nav className={cn('flex flex-col space-y-1 space-x-0', className)}>
      {adminSidebarNavItems.map((item) => (
        <Button
          key={item.href}
          size="sm"
          variant="ghost"
          asChild
          className={cn('w-full justify-start', {
            'bg-muted': isAdminNavItemActive(currentPath, item.href),
          })}
        >
          <Link href={item.href} prefetch onClick={onNavigate}>
            {item.title}
          </Link>
        </Button>
      ))}
    </nav>
  );
}

type AdminShellProps = PropsWithChildren<{
  contentClassName?: string;
  sectionClassName?: string;
  wrapperClassName?: string;
  rowClassName?: string;
  heading?: ReactNode;
}>;

export default function AdminShell({
  children,
  contentClassName,
  sectionClassName,
  wrapperClassName,
  rowClassName,
  heading,
}: AdminShellProps) {
  const currentPath = window.location.pathname;
  // Always start from session value; session itself starts as expanded (false).
  const [collapsed, setCollapsed] = useState(() => adminNavCollapsedSession);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value;
      adminNavCollapsedSession = next;
      return next;
    });
  };

  return (
    <div className={cn('px-4 py-6', wrapperClassName)}>
      <div className="mb-8 flex items-start gap-3">
        {/* Desktop: collapse/expand the left admin menu */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="mt-0.5 hidden shrink-0 lg:inline-flex"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand admin menu' : 'Collapse admin menu'}
          aria-pressed={collapsed}
          title={collapsed ? 'Expand admin menu' : 'Collapse admin menu'}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>

        {/* Mobile: open admin menu in a sheet for more working space */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="mt-0.5 shrink-0 lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open admin menu"
          title="Open admin menu"
        >
          <Menu />
        </Button>

        <div className="min-w-0 flex-1 [&>div]:mb-0">
          {heading ?? (
            <Heading
              title="Libeflix Admin Panel"
              description="Manage movies, tv shows, users, roles, permissions, analytics, engagement, and more"
            />
          )}
        </div>
      </div>

      <div
        className={cn(
          'flex flex-col space-y-8 lg:flex-row lg:space-y-0 lg:space-x-12',
          rowClassName,
        )}
      >
        {!collapsed && (
          <aside className="hidden w-full max-w-xl flex-shrink-0 lg:block lg:w-48">
            <AdminNavLinks currentPath={currentPath} />
          </aside>
        )}

        <div className={cn('min-w-0 flex-1', contentClassName)}>
          <section className={sectionClassName}>{children}</section>
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(100%,20rem)] p-0 sm:max-w-xs">
          <SheetHeader className="border-b px-4 py-4 text-left">
            <SheetTitle>Admin menu</SheetTitle>
            <SheetDescription>Navigate admin sections</SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto p-4">
            <AdminNavLinks
              currentPath={currentPath}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
