import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, CalendarClock, CalendarDays, Send } from 'lucide-react';
import { useMemo } from 'react';
import { PageHeader } from '@/components/gadai/page-header';
import { ReminderDialog } from '@/components/gadai/reminder-dialog';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { daysUntil, dueLabel, formatDate, formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/types/gadai';

type Group = {
    key: string;
    title: string;
    description: string;
    icon: typeof CalendarClock;
    tone: string;
    items: Transaction[];
};

export default function JatuhTempo({
    transactions,
}: {
    transactions: Transaction[];
}) {
    const groups = useMemo<Group[]>(() => {
        // Universe: everything still open (AKTIF, PERPANJANG, TIDAK_DIAMBIL)
        const open = transactions.filter(
            (t) =>
                t.status === 'AKTIF' ||
                t.status === 'PERPANJANG' ||
                t.status === 'TIDAK_DIAMBIL',
        );
        const byDue = (a: Transaction, b: Transaction) =>
            a.dueDate.localeCompare(b.dueDate);

        const terlambat = open
            .filter((t) => daysUntil(t.dueDate) < 0)
            .sort(byDue);
        const hariIni = open
            .filter((t) => daysUntil(t.dueDate) === 0)
            .sort(byDue);
        const mingguIni = open
            .filter((t) => {
                const d = daysUntil(t.dueDate);

                return d >= 1 && d <= 7;
            })
            .sort(byDue);
        const mendatang = open
            .filter((t) => daysUntil(t.dueDate) > 7)
            .sort(byDue);

        return [
            {
                key: 'terlambat',
                title: 'Terlambat',
                description: 'Lewat jatuh tempo, perlu segera ditindak.',
                icon: AlertTriangle,
                tone: 'text-overdue',
                items: terlambat,
            },
            {
                key: 'hari-ini',
                title: 'Jatuh Tempo Hari Ini',
                description: 'Jatuh tempo tepat hari ini.',
                icon: CalendarClock,
                tone: 'text-aktif',
                items: hariIni,
            },
            {
                key: 'minggu-ini',
                title: 'Dalam 7 Hari',
                description: 'Akan jatuh tempo minggu ini.',
                icon: CalendarDays,
                tone: 'text-foreground',
                items: mingguIni,
            },
            {
                key: 'mendatang',
                title: 'Lebih dari 7 Hari',
                description: 'Masih dalam masa gadai.',
                icon: CalendarDays,
                tone: 'text-muted-foreground',
                items: mendatang,
            },
        ];
    }, [transactions]);

    const perluTindak = groups[0].items.length + groups[1].items.length;

    return (
        <>
            <Head title="Jatuh Tempo" />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <PageHeader
                    title="Jatuh Tempo"
                    description={`${perluTindak} barang perlu ditindak hari ini atau sudah terlambat.`}
                />

                <div className="flex flex-col gap-5">
                    {groups.map((group) => (
                        <section
                            key={group.key}
                            className="overflow-hidden rounded-xl border bg-card shadow-sm"
                        >
                            <div className="flex items-center gap-3 border-b px-5 py-4">
                                <group.icon
                                    className={cn('size-4.5', group.tone)}
                                />
                                <div className="flex-1">
                                    <h2 className="font-semibold">
                                        {group.title}
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        {group.description}
                                    </p>
                                </div>
                                <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium tabular-nums">
                                    {group.items.length}
                                </span>
                            </div>

                            {group.items.length > 0 ? (
                                <ul className="divide-y">
                                    {group.items.map((t) => (
                                        <DueItem key={t.id} tx={t} />
                                    ))}
                                </ul>
                            ) : (
                                <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                                    Tidak ada barang di kelompok ini.
                                </p>
                            )}
                        </section>
                    ))}
                </div>
            </div>
        </>
    );
}

function DueItem({ tx }: { tx: Transaction }) {
    const d = daysUntil(tx.dueDate);
    const overdue = d <= 0;

    return (
        <li className="flex items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <Link
                        href={`/transaksi/${tx.id}`}
                        className="truncate font-medium hover:text-primary hover:underline"
                    >
                        {tx.customer.name}
                    </Link>
                    <StatusBadge status={tx.status} size="sm" />
                </div>
                <div className="truncate text-xs text-muted-foreground">
                    {tx.device.name} · {tx.id} · {tx.customer.phone}
                </div>
            </div>

            <div className="hidden text-right sm:block">
                <div className="text-sm font-medium tabular-nums">
                    {formatRupiah(tx.principal)}
                </div>
                <div
                    className={cn(
                        'text-xs',
                        overdue ? 'text-overdue' : 'text-muted-foreground',
                    )}
                >
                    {formatDate(tx.dueDate)} · {dueLabel(tx.dueDate)}
                </div>
            </div>

            <div className="flex items-center gap-1">
                <ReminderDialog tx={tx}>
                    <Button
                        variant="ghost"
                        size="icon"
                        title="Kirim pengingat WhatsApp"
                    >
                        <Send />
                    </Button>
                </ReminderDialog>
                <Button variant="outline" size="sm" asChild>
                    <Link href={`/transaksi/${tx.id}`}>Detail</Link>
                </Button>
            </div>
        </li>
    );
}

JatuhTempo.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Jatuh Tempo', href: '/jatuh-tempo' },
    ],
};
