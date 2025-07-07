import { SidebarProvider } from '@/components/ui/sidebar';
import { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';

interface AppShellProps {
    children: React.ReactNode;
    variant?: 'header' | 'sidebar';
}

export function AppShell({ children, variant = 'header' }: AppShellProps) {
    // Helper function to get initial sidebar state
    const getInitialSidebarState = () => {
        if (typeof window === 'undefined') return true;
        
        // Check for URL parameter first
        const urlParams = new URLSearchParams(window.location.search);
        const sidebarParam = urlParams.get('sidebar');
        
        if (sidebarParam !== null) {
            // If URL parameter exists, use it
            return sidebarParam !== 'collapsed';
        }
        
        // Fall back to localStorage if no URL parameter
        return localStorage.getItem('sidebar') !== 'false';
    };

    const [isOpen, setIsOpen] = useState(getInitialSidebarState);

    const handleSidebarChange = (open: boolean) => {
        setIsOpen(open);

        if (typeof window !== 'undefined') {
            localStorage.setItem('sidebar', String(open));
        }
    };

    // Update sidebar state when URL changes (for SPA navigation)
    useEffect(() => {
        const handleLocationChange = () => {
            const urlParams = new URLSearchParams(window.location.search);
            const sidebarParam = urlParams.get('sidebar');
            
            if (sidebarParam !== null) {
                const shouldBeOpen = sidebarParam !== 'collapsed';
                if (shouldBeOpen !== isOpen) {
                    setIsOpen(shouldBeOpen);
                    // Also update localStorage to persist the state
                    localStorage.setItem('sidebar', String(shouldBeOpen));
                }
            }
        };

        // Listen for browser navigation events
        window.addEventListener('popstate', handleLocationChange);
        
        // Listen for Inertia.js navigation events
        const unsubscribe = router.on('navigate', handleLocationChange);
        
        return () => {
            window.removeEventListener('popstate', handleLocationChange);
            unsubscribe();
        };
    }, [isOpen]);

    if (variant === 'header') {
        return <div className="flex min-h-screen w-full flex-col">{children}</div>;
    }

    return (
        <SidebarProvider defaultOpen={isOpen} open={isOpen} onOpenChange={handleSidebarChange}>
            {children}
        </SidebarProvider>
    );
}
