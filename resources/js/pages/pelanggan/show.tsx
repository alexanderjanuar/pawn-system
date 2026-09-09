import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarDays,
    ChevronRight,
    IdCard,
    MapPin,
    MoreVertical,
    PackageOpen,
    Pencil,
    Phone,
    PlusCircle,
    ShieldAlert,
    ShieldOff,
    StickyNote,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
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
import { Textarea } from '@/components/ui/textarea';
import { dueLabel, formatDate, formatRupiah } from '@/lib/format';
import { BLACKLIST_REASONS, STATUS_META } from '@/lib/gadai';
import { customerStats } from '@/lib/selectors';
import { cn, initials } from '@/lib/utils';
import type { Customer, Transaction } from '@/types/gadai';

export default function PelangganShow({
    customer,
    transactions,
}: {
    customer: Customer;
    transactions: Transaction[];
}) {
    const txs = transactions;
    const stats = customerStats(txs);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [blacklistOpen, setBlacklistOpen] = useState(false);

    const figures = [
        { label: 'Total Transaksi', value: String(stats.total) },
        { label: 'Gadai Aktif', value: String(stats.active) },
        {
            label: 'Dana Berjalan',
            value: formatRupiah(stats.runningPrincipal),
        },
        {
            label: 'Total Biaya Dibayar',
            value: formatRupiah(stats.feePaid),
            tone: 'text-primary',
        },
    ];

    return (
        <>
            <Head title={`${customer.name} · ${customer.id}`} />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="mb-2 -ml-2 text-muted-foreground"
                    >
                        <Link href="/pelanggan">
                            <ArrowLeft />
                            Pelanggan
                        </Link>
                    </Button>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-semibold text-foreground/80">
                                {initials(customer.name)}
                            </span>
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                                        {customer.name}
                                    </h1>
                                    {customer.blacklisted && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-lelang-soft px-2.5 py-1 text-xs font-medium text-lelang ring-1 ring-lelang/25 ring-inset">
                                            <ShieldAlert className="size-3.5" />
                                            Blacklist
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    <span className="tabular-nums">
                                        {customer.id}
                                    </span>{' '}
                                    · {customer.phone}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button asChild>
                                <Link
                                    href={`/gadai/baru?pelanggan=${customer.id}`}
                                >
                                    <PlusCircle />
                                    Gadai Baru
                                </Link>
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon">
                                        <MoreVertical />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        onClick={() => setEditOpen(true)}
                                    >
                                        <Pencil />
                                        Edit data
                                    </DropdownMenuItem>
                                    {customer.blacklisted ? (
                                        <DropdownMenuItem
                                            onClick={() =>
                                                router.delete(
                                                    `/pelanggan/${customer.id}/blacklist`,
                                                    { preserveScroll: true },
                                                )
                                            }
                                        >
                                            <ShieldOff />
                                            Cabut blacklist
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem
                                            onClick={() =>
                                                setBlacklistOpen(true)
                                            }
                                        >
                                            <ShieldAlert />
                                            Blacklist pelanggan
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        variant="destructive"
                                        onClick={() => setDeleteOpen(true)}
                                    >
                                        <Trash2 />
                                        Hapus pelanggan
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>

                <EditCustomerDialog
                    customer={customer}
                    open={editOpen}
                    onOpenChange={setEditOpen}
                />
                <DeleteCustomerDialog
                    customer={customer}
                    hasTransactions={txs.length > 0}
                    open={deleteOpen}
                    onOpenChange={setDeleteOpen}
                />
                <BlacklistDialog
                    customer={customer}
                    open={blacklistOpen}
                    onOpenChange={setBlacklistOpen}
                />

                {customer.blacklisted && (
                    <div className="flex items-start gap-2 rounded-lg border border-lelang/30 bg-lelang-soft/40 p-3 text-sm">
                        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-lelang" />
                        <div>
                            <p className="font-medium text-lelang">
                                Pelanggan diblacklist
                            </p>
                            <p className="text-muted-foreground">
                                {customer.blacklistReason ?? 'Tanpa keterangan'}{' '}
                                · hati-hati saat membuat transaksi baru.
                            </p>
                        </div>
                    </div>
                )}

                {/* Stat strip */}
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

                <div className="grid gap-5 lg:grid-cols-3">
                    {/* Riwayat gadai */}
                    <section className="overflow-hidden rounded-xl border bg-card shadow-sm lg:col-span-2">
                        <div className="border-b px-5 py-4">
                            <h2 className="font-semibold">Riwayat Gadai</h2>
                            <p className="text-xs text-muted-foreground">
                                {txs.length} transaksi
                            </p>
                        </div>

                        {txs.length > 0 ? (
                            <ul className="divide-y">
                                {txs.map((t) => (
                                    <HistoryRow key={t.id} t={t} />
                                ))}
                            </ul>
                        ) : (
                            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
                                <PackageOpen className="size-6 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                    Belum ada transaksi gadai.
                                </p>
                                <Button asChild variant="outline" size="sm">
                                    <Link
                                        href={`/gadai/baru?pelanggan=${customer.id}`}
                                    >
                                        <PlusCircle />
                                        Buat gadai pertama
                                    </Link>
                                </Button>
                            </div>
                        )}
                    </section>

                    {/* Profil */}
                    <aside className="lg:col-span-1">
                        <section className="sticky top-6 rounded-xl border bg-card p-5 shadow-sm sm:p-6">
                            <h2 className="mb-4 font-semibold">Profil</h2>
                            <dl className="space-y-4 text-sm">
                                <Info icon={Phone} label="Nomor HP">
                                    <span className="tabular-nums">
                                        {customer.phone}
                                    </span>
                                </Info>
                                <Info icon={MapPin} label="Alamat">
                                    {customer.address || '—'}
                                </Info>
                                <Info icon={IdCard} label="No. KTP">
                                    <span className="tabular-nums">
                                        {customer.idNumber || '—'}
                                    </span>
                                </Info>
                                <Info
                                    icon={CalendarDays}
                                    label="Bergabung sejak"
                                >
                                    {formatDate(customer.joinDate)}
                                </Info>
                                {customer.notes && (
                                    <Info icon={StickyNote} label="Catatan">
                                        {customer.notes}
                                    </Info>
                                )}
                            </dl>
                        </section>
                    </aside>
                </div>
            </div>
        </>
    );
}

function HistoryRow({ t }: { t: Transaction }) {
    const meta = STATUS_META[t.status];

    return (
        <li className="group relative">
            <Link
                href={`/transaksi/${t.id}`}
                className="absolute inset-0 z-10"
                aria-label={`Detail ${t.id}`}
            />
            <div className="relative flex items-center gap-3 px-5 py-3 transition-colors group-hover:bg-accent/50">
                <span
                    className={cn('size-2 shrink-0 rounded-full', meta.dot)}
                    aria-hidden
                />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                            {t.device.name}
                        </span>
                        <StatusBadge status={t.status} size="sm" />
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                        <span className="tabular-nums">{t.id}</span> · masuk{' '}
                        {formatDate(t.startDate)}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">
                        {formatRupiah(t.principal)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {meta.terminal
                            ? formatDate(t.dueDate)
                            : dueLabel(t.dueDate)}
                    </div>
                </div>
                <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground sm:block" />
            </div>
        </li>
    );
}

function Info({
    icon: Icon,
    label,
    children,
}: {
    icon: typeof Phone;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-start gap-3">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-medium">{children}</dd>
            </div>
        </div>
    );
}

function EditCustomerDialog({
    customer,
    open,
    onOpenChange,
}: {
    customer: Customer;
    open: boolean;
    onOpenChange: (value: boolean) => void;
}) {
    const { data, setData, put, processing, errors } = useForm({
        name: customer.name,
        phone: customer.phone,
        address: customer.address ?? '',
        id_number: customer.idNumber ?? '',
        notes: customer.notes ?? '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        put(`/pelanggan/${customer.id}`, {
            onSuccess: () => onOpenChange(false),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle>Edit Pelanggan</DialogTitle>
                        <DialogDescription>
                            Perbarui data {customer.name}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-1.5">
                            <Label htmlFor="e-nama">Nama</Label>
                            <Input
                                id="e-nama"
                                value={data.name}
                                onChange={(e) =>
                                    setData('name', e.target.value)
                                }
                            />
                            {errors.name && (
                                <p className="text-xs text-destructive">
                                    {errors.name}
                                </p>
                            )}
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-1.5">
                                <Label htmlFor="e-hp">Nomor HP</Label>
                                <Input
                                    id="e-hp"
                                    inputMode="numeric"
                                    value={data.phone}
                                    onChange={(e) =>
                                        setData('phone', e.target.value)
                                    }
                                />
                                {errors.phone && (
                                    <p className="text-xs text-destructive">
                                        {errors.phone}
                                    </p>
                                )}
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="e-ktp">No. KTP</Label>
                                <Input
                                    id="e-ktp"
                                    inputMode="numeric"
                                    value={data.id_number}
                                    onChange={(e) =>
                                        setData('id_number', e.target.value)
                                    }
                                />
                            </div>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="e-alamat">Alamat</Label>
                            <Input
                                id="e-alamat"
                                value={data.address}
                                onChange={(e) =>
                                    setData('address', e.target.value)
                                }
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="e-notes">Catatan</Label>
                            <Textarea
                                id="e-notes"
                                value={data.notes}
                                onChange={(e) =>
                                    setData('notes', e.target.value)
                                }
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">
                                Batal
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={processing}>
                            Simpan Perubahan
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function DeleteCustomerDialog({
    customer,
    hasTransactions,
    open,
    onOpenChange,
}: {
    customer: Customer;
    hasTransactions: boolean;
    open: boolean;
    onOpenChange: (value: boolean) => void;
}) {
    const [processing, setProcessing] = useState(false);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Hapus pelanggan?</DialogTitle>
                    <DialogDescription>
                        {hasTransactions
                            ? `${customer.name} masih punya transaksi, jadi tidak bisa dihapus. Hapus/selesaikan transaksinya dulu.`
                            : `${customer.name} akan dihapus permanen dari data pelanggan.`}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Batal</Button>
                    </DialogClose>
                    <Button
                        variant="destructive"
                        disabled={hasTransactions || processing}
                        onClick={() =>
                            router.delete(`/pelanggan/${customer.id}`, {
                                onStart: () => setProcessing(true),
                                onFinish: () => setProcessing(false),
                            })
                        }
                    >
                        <Trash2 />
                        Hapus Pelanggan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function BlacklistDialog({
    customer,
    open,
    onOpenChange,
}: {
    customer: Customer;
    open: boolean;
    onOpenChange: (value: boolean) => void;
}) {
    const { data, setData, put, processing, errors, reset } = useForm({
        reason: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        put(`/pelanggan/${customer.id}/blacklist`, {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                onOpenChange(false);
            },
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                onOpenChange(v);

                if (!v) {
                    reset();
                }
            }}
        >
            <DialogContent>
                <form onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle>Blacklist pelanggan</DialogTitle>
                        <DialogDescription>
                            {customer.name} akan ditandai bermasalah. Peringatan
                            muncul saat NIK atau nomor HP-nya dipakai untuk gadai
                            baru.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-4">
                        <div className="grid gap-1.5">
                            <Label htmlFor="bl-reason">Alasan</Label>
                            <Input
                                id="bl-reason"
                                value={data.reason}
                                onChange={(e) =>
                                    setData('reason', e.target.value)
                                }
                                placeholder="cth. Sering telat"
                            />
                            {errors.reason && (
                                <p className="text-xs text-destructive">
                                    {errors.reason}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {BLACKLIST_REASONS.map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setData('reason', r)}
                                    className={cn(
                                        'rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-accent',
                                        data.reason === r &&
                                            'border-transparent bg-primary text-primary-foreground hover:bg-primary',
                                    )}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">
                                Batal
                            </Button>
                        </DialogClose>
                        <Button
                            type="submit"
                            variant="destructive"
                            disabled={processing || !data.reason.trim()}
                        >
                            <ShieldAlert />
                            Blacklist
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

PelangganShow.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Pelanggan', href: '/pelanggan' },
        { title: 'Detail', href: '/pelanggan' },
    ],
};
