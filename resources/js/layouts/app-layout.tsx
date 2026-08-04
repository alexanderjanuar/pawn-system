import { usePage } from '@inertiajs/react';
import { FlashToaster } from '@/components/flash-toaster';
import AppLayoutTemplate from '@/layouts/app/app-sidebar-layout';
import { setServerToday } from '@/lib/format';
import type { BreadcrumbItem } from '@/types';

export default function AppLayout({
    breadcrumbs = [],
    children,
}: {
    breadcrumbs?: BreadcrumbItem[];
    children: React.ReactNode;
}) {
    // Use the server's date (WITA) as "today" for relative labels & overdue.
    setServerToday(usePage().props.serverDate);

    return (
        <AppLayoutTemplate breadcrumbs={breadcrumbs}>
            <FlashToaster />
            {children}
        </AppLayoutTemplate>
    );
}
