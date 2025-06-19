import type { route as routeFn } from 'ziggy-js';

declare global {
    const route: typeof routeFn;
    
    interface Window {
        auth: {
            user: any;
            subscription: any;
            canAccessPremium: boolean;
        };
    }
}
