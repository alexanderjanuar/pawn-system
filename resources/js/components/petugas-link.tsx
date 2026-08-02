import { Link, usePage } from '@inertiajs/react';
import { cn } from '@/lib/utils';

/**
 * Renders a petugas (clerk) name. For management users (owner/admin) it links
 * to that petugas's detail page, resolved by name; other roles see plain text.
 * Safe inside clickable rows: it stops click propagation.
 */
export function PetugasLink({
    name,
    className,
}: {
    name: string;
    className?: string;
}) {
    const role = usePage().props.auth.user?.role;
    const isManagement = role === 'owner' || role === 'admin';

    if (!isManagement || !name) {
        return <span className={className}>{name}</span>;
    }

    return (
        <Link
            href={`/pengaturan/petugas/by-name/${encodeURIComponent(name)}`}
            onClick={(e) => e.stopPropagation()}
            className={cn('hover:text-primary hover:underline', className)}
        >
            {name}
        </Link>
    );
}
