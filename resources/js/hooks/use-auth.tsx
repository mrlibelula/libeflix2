import { useState, useEffect, useCallback } from 'react';
import { usePage } from '@inertiajs/react';
import { type SharedData } from '@/types';

interface AuthHookReturn {
    user: any;
    isAuthenticated: boolean;
    isHydrated: boolean;
    isLoading: boolean;
    refreshAuth: () => void;
}

export function useAuth(): AuthHookReturn {
    const { auth } = usePage<SharedData>().props;
    const [isHydrated, setIsHydrated] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Handle initial hydration
    useEffect(() => {
        setIsHydrated(true);
        setCurrentUser(auth.user);
        setIsLoading(false);
    }, []);

    // Update auth state when page props change
    useEffect(() => {
        if (isHydrated) {
            setCurrentUser(auth.user);
            setIsLoading(false);
        }
    }, [auth.user, isHydrated]);

    // Listen for Inertia page visits to sync auth state
    useEffect(() => {
        const handleInertiaFinish = () => {
            // Small delay to ensure props have been updated
            setTimeout(() => {
                setCurrentUser(auth.user);
                setIsLoading(false);
            }, 10);
        };

        const handleInertiaStart = () => {
            // Don't show loading for subsequent navigations
            // Only show loading on initial hydration
            if (!isHydrated) {
                setIsLoading(true);
            }
        };

        // Listen for Inertia events
        document.addEventListener('inertia:finish', handleInertiaFinish);
        document.addEventListener('inertia:start', handleInertiaStart);

        return () => {
            document.removeEventListener('inertia:finish', handleInertiaFinish);
            document.removeEventListener('inertia:start', handleInertiaStart);
        };
    }, [auth.user, isHydrated]);

    // Refresh auth state manually
    const refreshAuth = useCallback(() => {
        setCurrentUser(auth.user);
    }, [auth.user]);

    return {
        user: currentUser,
        isAuthenticated: Boolean(currentUser),
        isHydrated,
        isLoading: isLoading || !isHydrated,
        refreshAuth,
    };
} 