import type { Auth } from '@/types/auth';

declare module 'react' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            sidebarOpen: boolean;
            overdueCount: number;
            approvalThreshold: number;
            stores: { id: number; name: string; code: string }[];
            activeStore: number | 'all';
            activeStoreName: string | null;
            serverDate: string; // YYYY-MM-DD, WITA — authoritative "today"
            flash: {
                success: string | null;
                error: string | null;
            };
            [key: string]: unknown;
        };
    }
}
