import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarDays,
    ChartPie,
    MoreVertical,
    PackageOpen,
    Pencil,
    Power,
    Receipt,
    Trash2,
    TrendingUp,
    UserCog,
} from 'lucide-react';
import { useState } from 'react';
import { BarChart } from '@/components/gadai/bar-chart';
import { DonutChart } from '@/components/gadai/donut-chart';
import { StatusBadge } from '@/components/status-badge';
import { TablePagination } from '@/components/table-pagination';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePagination } from '@/hooks/use-pagination';
import { formatDate, formatRupiah } from '@/lib/format';
import { STATUS_META } from '@/lib/gadai';
import { cn, initials } from '@/lib/utils';
import type { GadaiStatus } from '@/types/gadai';

type Petugas = { id: number; name: string; active: boolean };

type Stats = {
    total: number;
    totalPrincipal: number;
    totalFee: number;
    running: number;
    avgPrincipal: number;
    firstDate: string | null;
    lastDate: string | null;
};

type ByStatus = { status: GadaiStatus; count: number; principal: number };
type Monthly = { label: string; value: number; current: boolean };

type ClerkTransaction = {
    id: string;
    date: string;
    dueDate: string;
    customer: string;
    device: string;
    principal: number;
    fee: number;
    status: GadaiStatus;
    detailUrl: string;
};

type PageProps = {
    petugas: Petugas;
    stats: Stats;
    byStatus: ByStatus[];
    monthly: Monthly[];
    transactions: ClerkTransaction[];
};

export default function PetugasDetail({
    petugas,
    stats,
    byStatus,
    monthly,
    transactions,
}: PageProps) {
    const [renameOpen, setRenameOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);

    const toggleActive = () =>
        router.put(
            `/pengaturan/petugas/${petugas.id}`,
            { active: !petugas.active },
            { preserveScroll: true },
        );

    const figures = [
        { label: 'Total Transaksi', value: String(stats.total) },
        { label: 'Dana Tersalurkan', value: formatRupiah(stats.totalPrincipal) },
        {
            label: 'Biaya Titipan',
            value: formatRupiah(stats.totalFee),
            tone: 'text-primary',
        },
        { label: 'Transaksi Berjalan', value: String(stats.running) },
    ];

    const segments = byStatus.map((row) => ({
        label: STATUS_META[row.status].label,
        value: row.count,
        sub: formatRupiah(row.principal),
        colorClassName: STATUS_META[row.status].text,
    }));

    const periode =
        stats.firstDate && stats.lastDate
            ? stats.firstDate === stats.lastDate
                ? formatDate(stats.firstDate)
                : `${formatDate(stats.firstDate)} – ${formatDate(stats.lastDate)}`
            : null;

    return (
        <>
            <Head title={`Petugas · ${petugas.name}`} />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                {/* Header */}
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="mb-2 -ml-2 text-muted-foreground"
                    >
                        <Link href="/pengaturan/petugas">
                            <ArrowLeft />
                            Kelola Petugas
                        </Link>
                    </Button>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            <span
                                className={cn(
                                    'flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold',
                                    petugas.active
                                        ? 'bg-secondary text-foreground/80'
                                        : 'bg-muted text-muted-foreground',
                                )}
                            >
                                {initials(petugas.name)}
                            </span>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                                        {petugas.name}
                                    </h1>
                                    <StatusPill active={petugas.active} />
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {periode
                                        ? `Menangani transaksi ${periode}`
                                        : 'Belum menangani transaksi'}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" onClick={toggleActive}>
                                <Power />
                                {petugas.active ? 'Nonaktifkan' : 'Aktifkan'}
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon">
                                        <MoreVertical />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        onSelect={() => setRenameOpen(true)}
                                    >
                                        <Pencil />
                                        Ubah nama
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        variant="destructive"
                                        onSelect={() => setDeleteOpen(true)}
                                    >
                                        <Trash2 />
                                        Hapus
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>

                {/* KPI strip */}
                <div className="grid grid-cols-2 rounded-xl border bg-card shadow-sm lg:grid-cols-4">
                    {figures.map((f, i) => (
                        <div
                            key={f.label}
                            className={cn(
                                'flex min-w-0 flex-col gap-1 p-4 sm:p-5',
                                i % 2 === 1 && 'border-l',
                                i >= 2 && 'border-t lg:border-t-0',
                                (i === 2 || i === 3) && 'lg:border-l',
                            )}
                        >
                            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                {f.label}
                            </span>
                            <span
                                className={cn(
                                    'truncate text-base font-semibold tabular-nums sm:text-lg',
                                    f.tone,
                                )}
                            >
                                {f.value}
                            </span>
                        </div>
                    ))}
                </div>

                {stats.total === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card p-12 text-center">
                        <PackageOpen className="size-8 text-muted-foreground" />
                        <p className="font-medium">Belum ada transaksi</p>
                        <p className="max-w-sm text-sm text-muted-foreground">
                            Transaksi yang ditangani {petugas.name} akan muncul
                            di sini beserta ringkasannya.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-5 lg:grid-cols-3">
                        {/* Main */}
                        <div className="flex flex-col gap-5 lg:col-span-2">
                            <Card
                                icon={TrendingUp}
                                title="Dana Tersalurkan per Bulan"
                                subtitle="6 bulan terakhir"
                            >
                                <BarChart data={monthly} />
                            </Card>

                            <Card
                                icon={Receipt}
                                title="Riwayat Transaksi"
                                subtitle={`${stats.total} transaksi ditangani`}
                                bodyClassName="p-0"
                            >
                                <TransactionsTable
                                    transactions={transactions}
                                />
                            </Card>
                        </div>

                        {/* Aside */}
                        <div className="flex flex-col gap-5">
                            <Card
                                icon={ChartPie}
                                title="Transaksi per Status"
                            >
                                <DonutChart
                                    segments={segments}
                                    centerLabel="Transaksi"
                                />
                            </Card>

                            <Card icon={CalendarDays} title="Ringkasan">
                                <dl className="flex flex-col gap-3 text-sm">
                                    <SummaryRow
                                        label="Rata-rata dana"
                                        value={formatRupiah(stats.avgPrincipal)}
                                    />
                                    <SummaryRow
                                        label="Transaksi pertama"
                                        value={
                                            stats.firstDate
                                                ? formatDate(stats.firstDate)
                                                : '—'
                                        }
                                    />
                                    <SummaryRow
                                        label="Transaksi terakhir"
                                        value={
                                            stats.lastDate
                                                ? formatDate(stats.lastDate)
                                                : '—'
                                        }
                                    />
                                    <SummaryRow
                                        label="Status akun"
                                        value={
                                            petugas.active
                                                ? 'Aktif'
                                                : 'Nonaktif'
                                        }
                                    />
                                </dl>
                            </Card>
                        </div>
                    </div>
                )}
            </div>

            <RenameDialog
                petugas={petugas}
                open={renameOpen}
                onOpenChange={setRenameOpen}
            />
            <DeleteDialog
                petugas={petugas}
                total={stats.total}
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
            />
        </>
    );
}

function TransactionsTable({
    transactions,
}: {
    transactions: ClerkTransaction[];
}) {
    const {
        page,
        setPage,
        pageSize,
        setPageSize,
        pageItems,
        total,
        totalPages,
        from,
        to,
    } = usePagination(transactions, 10);

    return (
        <>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[44rem] text-sm">
                    <thead>
                        <tr className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
                            <th className="px-5 py-3 font-medium">Kode</th>
                            <th className="px-5 py-3 font-medium">Tanggal</th>
                            <th className="px-5 py-3 font-medium">Pelanggan</th>
                            <th className="px-5 py-3 font-medium">Status</th>
                            <th className="px-5 py-3 text-right font-medium">
                                Dana
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {pageItems.map((t) => (
                            <tr
                                key={t.id}
                                onClick={() => router.visit(t.detailUrl)}
                                className="group cursor-pointer transition-colors hover:bg-accent"
                            >
                                <td className="px-5 py-3">
                                    <div className="font-medium tabular-nums transition-colors group-hover:text-primary">
                                        {t.id}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {t.device}
                                    </div>
                                </td>
                                <td className="px-5 py-3 whitespace-nowrap text-muted-foreground tabular-nums">
                                    {formatDate(t.date)}
                                </td>
                                <td className="px-5 py-3">{t.customer}</td>
                                <td className="px-5 py-3">
                                    <StatusBadge status={t.status} />
                                </td>
                                <td className="px-5 py-3 text-right">
                                    <div className="font-medium tabular-nums">
                                        {formatRupiah(t.principal)}
                                    </div>
                                    <div className="text-xs text-muted-foreground tabular-nums">
                                        +{formatRupiah(t.fee)} biaya
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <TablePagination
                page={page}
                totalPages={totalPages}
                pageSize={pageSize}
                total={total}
                from={from}
                to={to}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
            />
        </>
    );
}

function Card({
    icon: Icon,
    title,
    subtitle,
    children,
    bodyClassName,
}: {
    icon: typeof Receipt;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    bodyClassName?: string;
}) {
    return (
        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex items-center gap-2 p-5 pb-0">
                <Icon className="size-4 text-muted-foreground" />
                <div>
                    <h2 className="font-semibold">{title}</h2>
                    {subtitle && (
                        <p className="text-xs text-muted-foreground">
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>
            <div className={cn('p-5', bodyClassName)}>{children}</div>
        </section>
    );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
        </div>
    );
}

function StatusPill({ active }: { active: boolean }) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                active
                    ? 'bg-aktif-soft text-aktif'
                    : 'bg-muted text-muted-foreground',
            )}
        >
            <span
                className={cn(
                    'size-1.5 rounded-full',
                    active ? 'bg-aktif' : 'bg-muted-foreground/50',
                )}
                aria-hidden
            />
            {active ? 'Aktif' : 'Nonaktif'}
        </span>
    );
}

function RenameDialog({
    petugas,
    open,
    onOpenChange,
}: {
    petugas: Petugas;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const form = useForm({ name: petugas.name });

    const submit = () =>
        form.put(`/pengaturan/petugas/${petugas.id}`, {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        });

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                onOpenChange(o);

                if (!o) {
                    form.setData('name', petugas.name);
                    form.clearErrors();
                }
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Ubah Nama Petugas</DialogTitle>
                    <DialogDescription>
                        Nama pada transaksi lama tidak berubah.
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                    }}
                    className="grid gap-1.5"
                >
                    <Label htmlFor="rename">Nama petugas</Label>
                    <Input
                        id="rename"
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        autoFocus
                    />
                    {form.errors.name && (
                        <p className="text-xs text-destructive">
                            {form.errors.name}
                        </p>
                    )}
                </form>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Batal
                    </Button>
                    <Button
                        onClick={submit}
                        disabled={form.processing || !form.data.name.trim()}
                    >
                        <UserCog />
                        Simpan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function DeleteDialog({
    petugas,
    total,
    open,
    onOpenChange,
}: {
    petugas: Petugas;
    total: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [processing, setProcessing] = useState(false);

    const confirm = () => {
        setProcessing(true);
        router.delete(`/pengaturan/petugas/${petugas.id}`, {
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Hapus Petugas</DialogTitle>
                    <DialogDescription>
                        Hapus{' '}
                        <span className="font-medium text-foreground">
                            {petugas.name}
                        </span>{' '}
                        dari daftar? Nama pada{' '}
                        {total > 0 ? `${total} transaksi lama` : 'transaksi lama'}{' '}
                        tetap tersimpan, hanya tidak lagi muncul sebagai pilihan.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Batal
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={confirm}
                        disabled={processing}
                    >
                        Hapus
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

PetugasDetail.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Kelola Petugas', href: '/pengaturan/petugas' },
        { title: 'Detail', href: '/pengaturan/petugas' },
    ],
};
