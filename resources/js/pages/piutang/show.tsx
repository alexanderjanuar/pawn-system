import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarClock,
    CheckCircle2,
    HandCoins,
    MoreVertical,
    Pencil,
    Plus,
    Save,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { DatePicker } from '@/components/gadai/date-picker';
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
import { Textarea } from '@/components/ui/textarea';
import { formatDate, formatRupiah, TODAY } from '@/lib/format';
import { cn } from '@/lib/utils';

type Payment = {
    id: number;
    amount: number;
    paidAt: string;
    by: string | null;
    note: string | null;
};

type TerminStatus = 'lunas' | 'belum' | 'telat';

type Termin = {
    seq: number;
    amount: number;
    dueDate: string;
    paid: number;
    status: TerminStatus;
};

type Piutang = {
    id: number;
    code: string;
    debtorName: string;
    deviceName: string;
    price: number;
    paid: number;
    remaining: number;
    status: 'berjalan' | 'lunas';
    date: string;
    clerk: string | null;
    notes: string | null;
    storeName: string | null;
    termins: Termin[];
    payments: Payment[];
};

export default function PiutangShow({
    piutang,
    canManage,
}: {
    piutang: Piutang;
    canManage: boolean;
}) {
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [terminOpen, setTerminOpen] = useState(false);
    const [deletePayment, setDeletePayment] = useState<Payment | null>(null);

    const lunas = piutang.status === 'lunas';
    const ratio =
        piutang.price > 0
            ? Math.min(1, piutang.paid / piutang.price)
            : lunas
              ? 1
              : 0;

    return (
        <>
            <Head title={`Piutang ${piutang.code}`} />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="mb-2 -ml-2 text-muted-foreground"
                    >
                        <Link href="/piutang">
                            <ArrowLeft />
                            Piutang
                        </Link>
                    </Button>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground/80">
                                <HandCoins className="size-5" />
                            </span>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
                                        {piutang.code}
                                    </h1>
                                    <StatusPill status={piutang.status} />
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {piutang.debtorName} · {piutang.deviceName}
                                    {piutang.storeName
                                        ? ` · ${piutang.storeName}`
                                        : ''}
                                </p>
                            </div>
                        </div>

                        {canManage && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon">
                                        <MoreVertical />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        onSelect={() => setEditOpen(true)}
                                    >
                                        <Pencil />
                                        Edit
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
                        )}
                    </div>
                </div>

                {/* Summary */}
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <Figure label="Total" value={formatRupiah(piutang.price)} />
                        <Figure
                            label="Sudah dibayar"
                            value={formatRupiah(piutang.paid)}
                            tone="text-primary"
                        />
                        <Figure
                            label="Sisa"
                            value={formatRupiah(piutang.remaining)}
                            tone={piutang.remaining > 0 ? 'text-perpanjang' : undefined}
                        />
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                            className={cn(
                                'h-full rounded-full transition-all',
                                lunas ? 'bg-diambil' : 'bg-primary',
                            )}
                            style={{ width: `${Math.round(ratio * 100)}%` }}
                        />
                    </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-3">
                    {/* Payments */}
                    <div className="flex flex-col gap-5 lg:col-span-2">
                        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
                            <div className="flex items-center justify-between gap-2 border-b p-4">
                                <span className="font-semibold">
                                    Jadwal Termin
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setTerminOpen(true)}
                                >
                                    <CalendarClock />
                                    {piutang.termins.length > 0
                                        ? 'Atur'
                                        : 'Buat jadwal'}
                                </Button>
                            </div>
                            {piutang.termins.length === 0 ? (
                                <p className="p-6 text-center text-sm text-muted-foreground">
                                    Belum ada jadwal termin. Pembayaran bebas
                                    nominal sampai lunas.
                                </p>
                            ) : (
                                <ul className="divide-y">
                                    {piutang.termins.map((t) => (
                                        <li
                                            key={t.seq}
                                            className="flex items-center gap-3 p-4"
                                        >
                                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold tabular-nums">
                                                {t.seq}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="font-medium tabular-nums">
                                                    {formatRupiah(t.amount)}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    Jatuh tempo{' '}
                                                    {formatDate(t.dueDate)}
                                                    {t.paid > 0 &&
                                                    t.paid < t.amount
                                                        ? ` · dibayar ${formatRupiah(t.paid)}`
                                                        : ''}
                                                </div>
                                            </div>
                                            <TerminPill status={t.status} />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        {lunas ? (
                            <div className="flex items-center gap-3 rounded-xl border border-diambil/30 bg-diambil-soft/40 p-4 text-sm">
                                <CheckCircle2 className="size-5 shrink-0 text-diambil" />
                                <div>
                                    <p className="font-medium text-diambil">
                                        Piutang lunas
                                    </p>
                                    <p className="text-muted-foreground">
                                        Semua pembayaran sudah diterima.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <PaymentForm piutang={piutang} />
                        )}

                        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
                            <div className="border-b p-4 font-semibold">
                                Riwayat Pembayaran
                            </div>
                            {piutang.payments.length === 0 ? (
                                <p className="p-6 text-center text-sm text-muted-foreground">
                                    Belum ada pembayaran.
                                </p>
                            ) : (
                                <ul className="divide-y">
                                    {piutang.payments.map((pay) => (
                                        <li
                                            key={pay.id}
                                            className="flex items-center gap-3 p-4"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="font-medium tabular-nums">
                                                    {formatRupiah(pay.amount)}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {formatDate(pay.paidAt)}
                                                    {pay.by ? ` · ${pay.by}` : ''}
                                                    {pay.note
                                                        ? ` · ${pay.note}`
                                                        : ''}
                                                </div>
                                            </div>
                                            {canManage && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="shrink-0"
                                                    onClick={() =>
                                                        setDeletePayment(pay)
                                                    }
                                                    title="Hapus pembayaran"
                                                >
                                                    <Trash2 className="text-muted-foreground" />
                                                </Button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>

                    {/* Info */}
                    <div className="lg:col-span-1">
                        <div className="flex flex-col gap-3 rounded-xl border bg-card p-5 text-sm shadow-sm">
                            <h2 className="font-semibold">Detail</h2>
                            <InfoRow label="Peminjam" value={piutang.debtorName} />
                            <InfoRow label="HP" value={piutang.deviceName} />
                            <InfoRow
                                label="Tanggal ambil"
                                value={formatDate(piutang.date)}
                            />
                            <InfoRow
                                label="Petugas"
                                value={piutang.clerk ?? '—'}
                            />
                            {piutang.notes && (
                                <div className="border-t pt-3">
                                    <p className="text-muted-foreground">
                                        Catatan
                                    </p>
                                    <p className="mt-1">{piutang.notes}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <EditPiutangDialog
                piutang={piutang}
                open={editOpen}
                onOpenChange={setEditOpen}
            />
            <AturTerminDialog
                piutang={piutang}
                open={terminOpen}
                onOpenChange={setTerminOpen}
            />
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hapus Piutang</DialogTitle>
                        <DialogDescription>
                            Hapus piutang {piutang.code} ({piutang.debtorName})
                            beserta seluruh riwayat pembayarannya? Tindakan ini
                            tidak dapat dibatalkan.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteOpen(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() =>
                                router.delete(`/piutang/${piutang.id}`)
                            }
                        >
                            Hapus
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {deletePayment && (
                <Dialog
                    open
                    onOpenChange={(o) => !o && setDeletePayment(null)}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Hapus Pembayaran</DialogTitle>
                            <DialogDescription>
                                Hapus pembayaran{' '}
                                {formatRupiah(deletePayment.amount)} tanggal{' '}
                                {formatDate(deletePayment.paidAt)}?
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setDeletePayment(null)}
                            >
                                Batal
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() =>
                                    router.delete(
                                        `/piutang/${piutang.id}/bayar/${deletePayment.id}`,
                                        {
                                            preserveScroll: true,
                                            onSuccess: () =>
                                                setDeletePayment(null),
                                        },
                                    )
                                }
                            >
                                Hapus
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}

function PaymentForm({ piutang }: { piutang: Piutang }) {
    const form = useForm({
        amount: 0,
        paid_at: TODAY.toISOString().slice(0, 10),
        note: '',
    });

    const submit = () =>
        form.post(`/piutang/${piutang.id}/bayar`, {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });

    return (
        <section className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="mb-1 font-semibold">Catat Pembayaran</h2>
            <p className="mb-4 text-xs text-muted-foreground">
                Sisa {formatRupiah(piutang.remaining)}. Nominal bebas sampai
                lunas.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="grid flex-1 gap-1.5">
                    <Label htmlFor="amount">Jumlah bayar</Label>
                    <div className="relative">
                        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                            Rp
                        </span>
                        <Input
                            id="amount"
                            inputMode="numeric"
                            value={
                                form.data.amount
                                    ? form.data.amount.toLocaleString('id-ID')
                                    : ''
                            }
                            onChange={(e) =>
                                form.setData(
                                    'amount',
                                    parseInt(
                                        e.target.value.replace(/\D/g, ''),
                                        10,
                                    ) || 0,
                                )
                            }
                            placeholder="0"
                            className="pl-9 tabular-nums"
                        />
                    </div>
                    {form.errors.amount && (
                        <p className="text-xs text-destructive">
                            {form.errors.amount}
                        </p>
                    )}
                </div>
                <div className="grid gap-1.5 sm:w-44">
                    <Label htmlFor="paid_at">Tanggal</Label>
                    <DatePicker
                        id="paid_at"
                        value={form.data.paid_at}
                        onChange={(v) => form.setData('paid_at', v)}
                    />
                </div>
                <Button
                    onClick={submit}
                    disabled={form.processing || form.data.amount <= 0}
                >
                    <Plus />
                    Catat
                </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
                {[piutang.remaining, 100_000, 200_000, 500_000]
                    .filter((v, i, arr) => v > 0 && arr.indexOf(v) === i)
                    .slice(0, 4)
                    .map((v) => (
                        <button
                            key={v}
                            type="button"
                            onClick={() =>
                                form.setData(
                                    'amount',
                                    Math.min(v, piutang.remaining),
                                )
                            }
                            className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                            {v === piutang.remaining
                                ? 'Lunasi'
                                : formatRupiah(v)}
                        </button>
                    ))}
            </div>
        </section>
    );
}

function EditPiutangDialog({
    piutang,
    open,
    onOpenChange,
}: {
    piutang: Piutang;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const form = useForm({
        debtor_name: piutang.debtorName,
        device_name: piutang.deviceName,
        price: piutang.price,
        date: piutang.date,
        notes: piutang.notes ?? '',
    });

    const submit = () =>
        form.put(`/piutang/${piutang.id}`, {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Piutang</DialogTitle>
                    <DialogDescription>
                        Ubah detail piutang. Riwayat pembayaran tidak berubah.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                    <div className="grid gap-1.5">
                        <Label htmlFor="edit-peminjam">Peminjam</Label>
                        <Input
                            id="edit-peminjam"
                            value={form.data.debtor_name}
                            onChange={(e) =>
                                form.setData('debtor_name', e.target.value)
                            }
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="edit-hp">Nama HP</Label>
                        <Input
                            id="edit-hp"
                            value={form.data.device_name}
                            onChange={(e) =>
                                form.setData('device_name', e.target.value)
                            }
                        />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="edit-harga">Total harga</Label>
                            <div className="relative">
                                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                                    Rp
                                </span>
                                <Input
                                    id="edit-harga"
                                    inputMode="numeric"
                                    value={
                                        form.data.price
                                            ? form.data.price.toLocaleString(
                                                  'id-ID',
                                              )
                                            : ''
                                    }
                                    onChange={(e) =>
                                        form.setData(
                                            'price',
                                            parseInt(
                                                e.target.value.replace(
                                                    /\D/g,
                                                    '',
                                                ),
                                                10,
                                            ) || 0,
                                        )
                                    }
                                    className="pl-9 tabular-nums"
                                />
                            </div>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="edit-tgl">Tanggal ambil</Label>
                            <DatePicker
                                id="edit-tgl"
                                value={form.data.date}
                                onChange={(v) => form.setData('date', v)}
                            />
                        </div>
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="edit-catatan">Catatan</Label>
                        <Textarea
                            id="edit-catatan"
                            value={form.data.notes}
                            onChange={(e) =>
                                form.setData('notes', e.target.value)
                            }
                            rows={2}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Batal
                    </Button>
                    <Button
                        onClick={submit}
                        disabled={form.processing || form.data.price <= 0}
                    >
                        <Save />
                        Simpan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function AturTerminDialog({
    piutang,
    open,
    onOpenChange,
}: {
    piutang: Piutang;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const form = useForm({ termin_count: piutang.termins.length });

    const submit = () =>
        form.put(`/piutang/${piutang.id}/termin`, {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        });

    const count = form.data.termin_count;
    const perTermin =
        count >= 2 ? Math.floor(piutang.price / count) : piutang.price;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Atur Termin</DialogTitle>
                    <DialogDescription>
                        Bagi total {formatRupiah(piutang.price)} jadi beberapa
                        termin. Jatuh tempo tiap bulan sejak tanggal ambil.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-1.5">
                    <Label htmlFor="termin-count">Jumlah termin</Label>
                    <Input
                        id="termin-count"
                        type="number"
                        min={0}
                        max={24}
                        value={form.data.termin_count || ''}
                        onChange={(e) =>
                            form.setData(
                                'termin_count',
                                parseInt(e.target.value, 10) || 0,
                            )
                        }
                        placeholder="cth. 3"
                        className="no-spinner tabular-nums"
                        autoFocus
                    />
                    <p className="text-xs text-muted-foreground">
                        {count >= 2
                            ? `± ${formatRupiah(perTermin)} per termin, ${count}x.`
                            : '0 atau 1 = tanpa jadwal (bayar bebas).'}
                    </p>
                    {form.errors.termin_count && (
                        <p className="text-xs text-destructive">
                            {form.errors.termin_count}
                        </p>
                    )}
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Batal
                    </Button>
                    <Button onClick={submit} disabled={form.processing}>
                        <Save />
                        Simpan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function TerminPill({ status }: { status: TerminStatus }) {
    const meta: Record<TerminStatus, { label: string; cls: string }> = {
        lunas: { label: 'Lunas', cls: 'bg-diambil-soft text-diambil' },
        telat: { label: 'Telat', cls: 'bg-overdue-soft text-overdue' },
        belum: { label: 'Belum', cls: 'bg-muted text-muted-foreground' },
    };

    return (
        <span
            className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                meta[status].cls,
            )}
        >
            {meta[status].label}
        </span>
    );
}

function StatusPill({ status }: { status: 'berjalan' | 'lunas' }) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                status === 'lunas'
                    ? 'bg-diambil-soft text-diambil'
                    : 'bg-perpanjang-soft text-perpanjang',
            )}
        >
            <span
                className={cn(
                    'size-1.5 rounded-full',
                    status === 'lunas' ? 'bg-diambil' : 'bg-perpanjang',
                )}
                aria-hidden
            />
            {status === 'lunas' ? 'Lunas' : 'Berjalan'}
        </span>
    );
}

function Figure({
    label,
    value,
    tone,
}: {
    label: string;
    value: string;
    tone?: string;
}) {
    return (
        <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </p>
            <p
                className={cn(
                    'truncate text-lg font-semibold tabular-nums',
                    tone,
                )}
            >
                {value}
            </p>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
        </div>
    );
}

PiutangShow.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Piutang', href: '/piutang' },
        { title: 'Detail', href: '/piutang' },
    ],
};
