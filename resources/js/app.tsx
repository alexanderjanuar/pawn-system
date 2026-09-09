import { createInertiaApp } from '@inertiajs/react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { reportClientError } from '@/lib/report-error';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    layout: (name) => {
        switch (true) {
            case name === 'welcome':
            case name === 'cek-status':
            case name === 'transaksi/nota':
            case name === 'laporan/cetak':
            case name === 'rak/label':
                return null;
            case name.startsWith('auth/'):
                return AuthLayout;
            case name.startsWith('settings/'):
                return [AppLayout, SettingsLayout];
            default:
                return AppLayout;
        }
    },
    strictMode: true,
    withApp(app) {
        return (
            <ErrorBoundary>
                <TooltipProvider delayDuration={0}>
                    {app}
                    <Toaster />
                </TooltipProvider>
            </ErrorBoundary>
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// Errors thrown outside React's render pass (event handlers, async work) never
// reach the error boundary, so they are reported here instead.
window.addEventListener('error', (event) => {
    reportClientError(event.error ?? event.message, 'runtime');
});

window.addEventListener('unhandledrejection', (event) => {
    reportClientError(event.reason, 'promise');
});

// This will set light / dark mode on load...
initializeTheme();
