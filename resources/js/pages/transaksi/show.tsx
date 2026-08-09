import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    Boxes,
    Check,
    Coins,
    Gavel,
    IdCard,
    ImageIcon,
    MapPin,
    MoreVertical,
    Pencil,
    Phone,
    Printer,
    QrCode,
    RefreshCw,
    ShieldCheck,
    Smartphone,
    Trash2,
    Wallet,
    X,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { DatePicker } from '@/components/gadai/date-picker';
import { ImageLightbox } from '@/components/gadai/image-lightbox';
import { PageHeader } from '@/components/gadai/page-header';
import { PatternLock } from '@/components/gadai/pattern-lock';
import { QrLightbox } from '@/components/gadai/qr-lightbox';
import { Timeline } from '@/components/gadai/timeline';
import { TransactionQr } from '@/components/gadai/transaction-qr';
import { PetugasLink } from '@/components/petugas-link';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    addDays,
    daysUntil,
    dueLabel,
    formatDate,
    formatRupiah,
} from '@/lib/format';
import { computeFee, STATUS_META } from '@/lib/gadai';
import { cn } from '@/lib/utils';
import type { HistoryEntry, Transaction } from '@/types/gadai';

export default function TransaksiShow({
    transaction,
    history,
}: {
    transaction: Transaction;
    history: HistoryEntry[];
}) {
    const tx = transaction;
    const page = usePage().props;
    const role = page.auth.user?.role;
    const canApprove = role === 'owner' || role === 'admin';
    const approvalThreshold = page.approvalThreshold;
    const pending = tx.approvalStatus === 'pending';
    const rejected = tx.approvalStatus === 'rejected';
    const approved = tx.approvalStatus === 'approved';
    // Disbursement actions only apply once the loan is approved and still live.
    const running = approved && !STATUS_META[tx.status].terminal;
    const total = tx.principal + tx.fee;
    const d = daysUntil(tx.dueDate);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [saleOpen, setSaleOpen] = useState(false);
    const [lelangOpen, setLelangOpen] = useState(false);
    const [revertOpen, setRevertOpen] = useState(false);
    const [tidakDiambilOpen, setTidakDiambilOpen] = useState(false);

    const lelang = tx.status === 'LELANG';
    const notRedeemed = tx.status === 'TIDAK_DIAMBIL';
    // Past due and still live: prompt the owner/clerk to decide the next step.
    const overdue = running && d <= 0;
    const saleNet = tx.saleValue != null ? tx.saleValue - tx.principal : null;

    const approve = () =>
        router.post(
            `/transaksi/${tx.id}/approve`,
            {},
            { preserveScroll: true },
        );
    const reject = () =>
        router.post(`/transaksi/${tx.id}/reject`, {}, { preserveScroll: true });
    const markLelang = () =>
        router.post(
            `/transaksi/${tx.id}/lelang`,
            {},
            { preserveScroll: true, onSuccess: () => setLelangOpen(false) },
        );
    const revertLelang = () =>
        router.post(
            `/transaksi/${tx.id}/lelang/batal`,
            {},
            { preserveScroll: true, onSuccess: () => setRevertOpen(false) },
        );
    const markTidakDiambil = () =>
        router.post(
            `/transaksi/${tx.id}/tidak-diambil`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => setTidakDiambilOpen(false),
            },
        );

    return (
        <>
            <Head title={`${tx.id} · ${tx.customer.name}`} />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="mb-2 -ml-2 text-muted-foreground"
                    >
                        <Link href="/transaksi">
                            <ArrowLeft />
                            Transaksi
                        </Link>
                    </Button>
                    <PageHeader
                        title={tx.id}
                        description={
                            <>
                                Masuk {formatDate(tx.startDate)} · Petugas{' '}
                                <PetugasLink
                                    name={tx.clerk}
                                    className="font-medium text-foreground"
                                />
                            </>
                        }
                    >
                        <div className="flex flex-wrap items-center gap-2">
                            {pending && canApprove && (
                                <>
                                    <Button variant="outline" onClick={reject}>
                                        <X />
                                        Tolak
                                    </Button>
                                    <Button onClick={approve}>
                                        <Check />
                                        Setujui Pencairan
                                    </Button>
                                </>
                            )}
                            {running && (
                                <>
                                    <PerpanjangDialog tx={tx} />
                                    <TebusDialog tx={tx} />
                                </>
                            )}
                            {approved && (
                                <Button variant="outline" asChild>
                                    <Link href={`/transaksi/${tx.id}/nota`}>
                                        <Printer />
                                        Cetak Nota
                                    </Link>
                                </Button>
                            )}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon">
                                        <MoreVertical />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                        <Link href={`/transaksi/${tx.id}/edit`}>
                                            <Pencil />
                                            Edit transaksi
                                        </Link>
                                    </DropdownMenuItem>
                                    {running && !notRedeemed && (
                                        <DropdownMenuItem
                                            onSelect={() =>
                                                setTidakDiambilOpen(true)
                                            }
                                        >
                                            <AlertTriangle />
                                            Tandai Tidak Diambil
                                        </DropdownMenuItem>
                                    )}
                                    {running && (
                                        <DropdownMenuItem
                                            onSelect={() => setLelangOpen(true)}
                                        >
                                            <Gavel />
                                            Tandai Lelang
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        variant="destructive"
                                        onClick={() => setDeleteOpen(true)}
                                    >
                                        <Trash2 />
                                        Hapus transaksi
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </PageHeader>

                    <DeleteTransactionDialog
                        tx={tx}
                        open={deleteOpen}
                        onOpenChange={setDeleteOpen}
                    />
                    <ConfirmDialog
                        open={lelangOpen}
                        onOpenChange={setLelangOpen}
                        title="Tandai untuk Lelang?"
                        description={`Barang ${tx.id} akan ditandai untuk dilelang. Pelanggan tidak lagi bisa menebus sampai lelang dibatalkan.`}
                        confirmLabel="Tandai Lelang"
                        onConfirm={markLelang}
                        icon={<Gavel />}
                    />
                    <ConfirmDialog
                        open={revertOpen}
                        onOpenChange={setRevertOpen}
                        title="Batalkan Lelang?"
                        description={`Barang ${tx.id} dikembalikan dari lelang menjadi Aktif, sehingga bisa ditebus atau diperpanjang lagi.`}
                        confirmLabel="Batal Lelang"
                        onConfirm={revertLelang}
                        icon={<RefreshCw />}
                    />
                    <ConfirmDialog
                        open={tidakDiambilOpen}
                        onOpenChange={setTidakDiambilOpen}
                        title="Tandai Tidak Diambil?"
                        description={`Barang ${tx.id} ditandai tidak diambil karena lewat jatuh tempo. Barang masih bisa ditebus, diperpanjang, atau dilanjutkan ke lelang.`}
                        confirmLabel="Tandai Tidak Diambil"
                        onConfirm={markTidakDiambil}
                        icon={<AlertTriangle />}
                    />
                    <RecordSaleDialog
                        tx={tx}
                        open={saleOpen}
                        onOpenChange={setSaleOpen}
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <StatusBadge
                            status={tx.status}
                            withIcon={!running}
                            pulse={running}
                        />
                        {pending && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-overdue-soft px-2.5 py-1 text-xs font-medium text-overdue ring-1 ring-overdue/25 ring-inset">
                                <ShieldCheck className="size-3.5" />
                                Menunggu Persetujuan
                            </span>
                        )}
                        {rejected && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-lelang-soft px-2.5 py-1 text-xs font-medium text-lelang ring-1 ring-lelang/25 ring-inset">
                                <X className="size-3.5" />
                                Pencairan Ditolak
                            </span>
                        )}
                    </div>

                    {pending && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-overdue/30 bg-overdue-soft/40 p-3 text-sm">
                            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-overdue" />
                            <div>
                                <p className="font-medium">
                                    Menunggu persetujuan Pemilik
                                </p>
                                <p className="text-muted-foreground">
                                    Pinjaman {formatRupiah(tx.principal)} di
                                    atas {formatRupiah(approvalThreshold)} —
                                    dana belum dicairkan sampai disetujui.
                                    {canApprove
                                        ? ''
                                        : ' Hubungi Pemilik untuk persetujuan.'}
                                </p>
                            </div>
                        </div>
                    )}
                    {rejected && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-lelang/30 bg-lelang-soft/40 p-3 text-sm">
                            <X className="mt-0.5 size-4 shrink-0 text-lelang" />
                            <div>
                                <p className="font-medium">Pencairan ditolak</p>
                                <p className="text-muted-foreground">
                                    Ditolak oleh {tx.approvedBy ?? 'Pemilik'}
                                    {tx.approvedAt ? ` · ${tx.approvedAt}` : ''}
                                    . Dana tidak dicairkan.
                                </p>
                            </div>
                        </div>
                    )}
                    {overdue && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-overdue/30 bg-overdue-soft/40 p-3 text-sm">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-overdue" />
                            <div className="min-w-0 flex-1">
                                <p className="font-medium">
                                    {notRedeemed
                                        ? 'Barang belum diambil'
                                        : 'Sudah lewat jatuh tempo'}
                                </p>
                                <p className="text-muted-foreground">
                                    {dueLabel(tx.dueDate)}.{' '}
                                    {notRedeemed
                                        ? 'Lanjutkan ke lelang bila barang tidak akan ditebus.'
                                        : 'Tentukan langkah selanjutnya: tandai barang tidak diambil, atau lanjut ke lelang.'}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {!notRedeemed && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setTidakDiambilOpen(true)
                                            }
                                        >
                                            <AlertTriangle />
                                            Tandai Tidak Diambil
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        onClick={() => setLelangOpen(true)}
                                    >
                                        <Gavel />
                                        Tandai Lelang
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid gap-5 lg:grid-cols-3">
                    <div className="flex flex-col gap-5 lg:col-span-2">
                        {/* Dana */}
                        <div className="rounded-xl border bg-card shadow-sm">
                            <div className="grid grid-cols-2 sm:grid-cols-4">
                                <Figure
                                    label="Dana Titipan"
                                    value={formatRupiah(tx.principal)}
                                />
                                <Figure
                                    label={`Biaya (${tx.feePercent}%)`}
                                    value={formatRupiah(tx.fee)}
                                    className="border-l"
                                    valueClass="text-primary"
                                />
                                <Figure
                                    label="Total Tebus"
                                    value={formatRupiah(total)}
                                    className="border-t sm:border-t-0 sm:border-l"
                                    emphasize
                                />
                                <Figure
                                    label="Jatuh Tempo"
                                    value={formatDate(tx.dueDate)}
                                    hint={
                                        running
                                            ? dueLabel(tx.dueDate)
                                            : undefined
                                    }
                                    hintClass={
                                        running && d <= 0
                                            ? 'text-overdue'
                                            : undefined
                                    }
                                    className="border-t border-l sm:border-t-0"
                                />
                            </div>
                        </div>

                        {/* Lelang */}
                        {lelang && (
                            <section className="rounded-xl border border-lelang/30 bg-lelang-soft/30 p-5 shadow-sm sm:p-6">
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <Gavel className="size-4.5 text-lelang" />
                                        <h2 className="font-semibold">
                                            Barang Lelang
                                        </h2>
                                    </div>
                                    {tx.saleValue == null && (
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setRevertOpen(true)
                                                }
                                            >
                                                <RefreshCw />
                                                Batal Lelang
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => setSaleOpen(true)}
                                            >
                                                <Coins />
                                                Catat Penjualan
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    <LelangCell
                                        label="Nilai Pinjaman"
                                        value={formatRupiah(tx.principal)}
                                    />
                                    <LelangCell
                                        label="Jatuh Tempo"
                                        value={formatDate(tx.dueDate)}
                                    />
                                    <LelangCell
                                        label="Nilai Jual"
                                        value={
                                            tx.saleValue != null
                                                ? formatRupiah(tx.saleValue)
                                                : 'Belum terjual'
                                        }
                                    />
                                    {saleNet != null && (
                                        <LelangCell
                                            label={
                                                saleNet >= 0
                                                    ? 'Keuntungan'
                                                    : 'Kerugian'
                                            }
                                            value={`${saleNet >= 0 ? '+' : '−'}${formatRupiah(Math.abs(saleNet))}`}
                                            tone={
                                                saleNet >= 0
                                                    ? 'text-primary'
                                                    : 'text-lelang'
                                            }
                                        />
                                    )}
                                </div>
                                {tx.soldAt && (
                                    <p className="mt-3 text-xs text-muted-foreground">
                                        Terjual {formatDate(tx.soldAt)}
                                    </p>
                                )}
                            </section>
                        )}

                        {/* Barang */}
                        <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
                            <div className="mb-4 flex items-center gap-2">
                                <Smartphone className="size-4.5 text-muted-foreground" />
                                <h2 className="font-semibold">Barang</h2>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <p className="text-lg font-semibold">
                                        {tx.device.name}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {tx.device.kelengkapan}
                                    </p>
                                    <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground/80">
                                        <Boxes className="size-3.5" />
                                        {tx.rak
                                            ? `Rak: ${tx.rak}`
                                            : 'Rak belum ditentukan'}
                                    </span>
                                </div>
                                <Spec label="RAM" value={tx.device.ram} />
                                <Spec
                                    label="Memori Internal"
                                    value={tx.device.storage}
                                />
                                <Spec
                                    label="Nomor Seri"
                                    value={tx.device.serial}
                                    mono
                                />
                                {tx.device.imei1 && (
                                    <Spec
                                        label="IMEI 1"
                                        value={tx.device.imei1}
                                        mono
                                    />
                                )}
                                {tx.device.imei2 && (
                                    <Spec
                                        label="IMEI 2"
                                        value={tx.device.imei2}
                                        mono
                                    />
                                )}
                                <Spec
                                    label="Pemilik Device"
                                    value={tx.deviceOwner}
                                />
                                {tx.device.lockType === 'none' ||
                                !tx.device.lockValue ? (
                                    <Spec label="Kunci HP" value="Tidak ada" />
                                ) : tx.device.lockType === 'pattern' ? (
                                    <div className="grid gap-1.5 sm:col-span-2">
                                        <span className="text-xs text-muted-foreground">
                                            Kunci HP · Pola
                                        </span>
                                        <PatternLock
                                            value={tx.device.lockValue}
                                            size={140}
                                        />
                                        <span className="text-xs text-muted-foreground">
                                            Urutan:{' '}
                                            {tx.device.lockValue
                                                .split('-')
                                                .join(' → ')}
                                        </span>
                                    </div>
                                ) : (
                                    <Spec
                                        label={
                                            tx.device.lockType === 'pin'
                                                ? 'Kunci HP · PIN'
                                                : 'Kunci HP · Kata Sandi'
                                        }
                                        value={tx.device.lockValue}
                                        mono
                                    />
                                )}
                            </div>

                            {(tx.photos?.length ?? 0) > 0 || tx.ktp ? (
                                <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
                                    {tx.photos?.map((p, i) => (
                                        <PhotoThumb
                                            key={p.url}
                                            url={p.url}
                                            label={p.label || `Foto ${i + 1}`}
                                        />
                                    ))}
                                    {tx.ktp && (
                                        <PhotoThumb
                                            url={tx.ktp}
                                            label="Scan KTP"
                                        />
                                    )}
                                </div>
                            ) : (
                                <div className="mt-5 grid grid-cols-4 gap-3 sm:grid-cols-5">
                                    <PhotoSlot label="Foto 1" />
                                    <PhotoSlot label="Foto 2" />
                                    <PhotoSlot label="Foto 3" />
                                    <PhotoSlot label="Scan KTP" wide />
                                </div>
                            )}
                        </section>

                        {/* Pelanggan */}
                        <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
                            <div className="mb-4 flex items-center gap-2">
                                <IdCard className="size-4.5 text-muted-foreground" />
                                <h2 className="font-semibold">Pelanggan</h2>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Spec label="Nama" value={tx.customer.name} />
                                <Spec
                                    label="No. KTP"
                                    value={tx.customer.idNumber}
                                    mono
                                />
                                <div className="flex items-start gap-2 text-sm">
                                    <Phone className="mt-0.5 size-4 text-muted-foreground" />
                                    <span className="tabular-nums">
                                        {tx.customer.phone}
                                    </span>
                                </div>
                                <div className="flex items-start gap-2 text-sm">
                                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                    <span>{tx.customer.address}</span>
                                </div>
                            </div>
                        </section>

                        {tx.notes && (
                            <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
                                <h2 className="mb-2 font-semibold">Catatan</h2>
                                <p className="text-sm text-muted-foreground">
                                    {tx.notes}
                                </p>
                            </section>
                        )}
                    </div>

                    {/* QR + Riwayat */}
                    <aside className="flex flex-col gap-5 lg:col-span-1">
                        <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
                            <div className="mb-4 flex items-center gap-2">
                                <QrCode className="size-4.5 text-muted-foreground" />
                                <h2 className="font-semibold">QR Transaksi</h2>
                            </div>
                            <div className="flex items-center gap-4">
                                <QrLightbox
                                    value={tx.detailUrl}
                                    label={`QR Transaksi ${tx.id}`}
                                    caption="Scan untuk membuka detail transaksi ini."
                                >
                                    <button
                                        type="button"
                                        title="Perbesar QR"
                                        className="rounded-lg border bg-white p-2 transition hover:ring-2 hover:ring-primary/40"
                                    >
                                        <TransactionQr
                                            value={tx.detailUrl}
                                            size={104}
                                        />
                                    </button>
                                </QrLightbox>
                                <div className="min-w-0 text-sm text-muted-foreground">
                                    Ketuk QR untuk memperbesar, menyalin, atau
                                    mengunduh. Scan untuk membuka detail
                                    transaksi ini.
                                    <span className="mt-1 block font-medium text-foreground tabular-nums">
                                        {tx.id}
                                    </span>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
                            <div className="mb-5 flex items-center gap-2">
                                <RefreshCw className="size-4.5 text-muted-foreground" />
                                <h2 className="font-semibold">Riwayat</h2>
                            </div>
                            <Timeline events={history} />
                        </section>
                    </aside>
                </div>
            </div>
        </>
    );
}

function Figure({
    label,
    value,
    hint,
    hintClass,
    className,
    valueClass,
    emphasize,
}: {
    label: string;
    value: string;
    hint?: string;
    hintClass?: string;
    className?: string;
    valueClass?: string;
    emphasize?: boolean;
}) {
    return (
        <div className={cn('flex min-w-0 flex-col gap-1 p-4 sm:p-5', className)}>
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </span>
            <span
                className={cn(
                    'truncate font-semibold tabular-nums',
                    emphasize ? 'text-lg sm:text-xl' : 'text-base sm:text-lg',
                    valueClass,
                )}
            >
                {value}
            </span>
            {hint && (
                <span
                    className={cn('text-xs text-muted-foreground', hintClass)}
                >
                    {hint}
                </span>
            )}
        </div>
    );
}

function Spec({
    label,
    value,
    mono,
}: {
    label: string;
    value: string;
    mono?: boolean;
}) {
    return (
        <div className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className={cn('text-sm font-medium', mono && 'tabular-nums')}>
                {value}
            </span>
        </div>
    );
}

function PhotoSlot({ label, wide }: { label: string; wide?: boolean }) {
    return (
        <div
            className={cn(
                'flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-muted/40 text-muted-foreground',
                wide && 'aspect-square',
            )}
        >
            <ImageIcon className="size-5" />
            <span className="text-[10px]">{label}</span>
        </div>
    );
}

function PhotoThumb({ url, label }: { url: string; label: string }) {
    return (
        <ImageLightbox url={url} label={label}>
            <button
                type="button"
                title={`Perbesar ${label}`}
                className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
            >
                <img
                    src={url}
                    alt={label}
                    className="size-full object-cover transition-transform group-hover:scale-105"
                />
                <span className="absolute inset-x-0 bottom-0 bg-black/50 px-1.5 py-0.5 text-left text-[10px] text-white">
                    {label}
                </span>
            </button>
        </ImageLightbox>
    );
}

function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    onConfirm,
    icon,
}: {
    open: boolean;
    onOpenChange: (value: boolean) => void;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
    icon?: ReactNode;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Batal</Button>
                    </DialogClose>
                    <Button onClick={onConfirm}>
                        {icon}
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function DeleteTransactionDialog({
    tx,
    open,
    onOpenChange,
}: {
    tx: Transaction;
    open: boolean;
    onOpenChange: (value: boolean) => void;
}) {
    const [processing, setProcessing] = useState(false);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Hapus transaksi?</DialogTitle>
                    <DialogDescription>
                        Transaksi{' '}
                        <span className="font-medium text-foreground">
                            {tx.id}
                        </span>{' '}
                        ({tx.customer.name}) akan dihapus permanen beserta foto
                        dan riwayatnya. Tindakan ini tidak bisa dibatalkan.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Batal</Button>
                    </DialogClose>
                    <Button
                        variant="destructive"
                        disabled={processing}
                        onClick={() =>
                            router.delete(`/transaksi/${tx.id}`, {
                                onStart: () => setProcessing(true),
                                onFinish: () => setProcessing(false),
                            })
                        }
                    >
                        <Trash2 />
                        Hapus Transaksi
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function PerpanjangDialog({ tx }: { tx: Transaction }) {
    const [open, setOpen] = useState(false);
    // The extension fee follows this transaction's own interest rate, the same
    // for 15 or 30 days. Custom still lets the clerk set a one-off amount.
    const presetFee = computeFee(tx.principal, tx.feePercent);
    const { data, setData, post, processing, errors, reset, clearErrors } =
        useForm({
            mode: '15' as '15' | '30' | 'custom',
            until: addDays(tx.dueDate, 15),
            fee: presetFee,
            fee_paid: false,
        });

    const newDue =
        data.mode === '15'
            ? addDays(tx.dueDate, 15)
            : data.mode === '30'
              ? addDays(tx.dueDate, 30)
              : data.until;
    const fee = data.mode === 'custom' ? Math.max(0, data.fee || 0) : presetFee;

    const submit = () =>
        post(`/transaksi/${tx.id}/perpanjang`, {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                reset();
            },
        });

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                setOpen(o);

                if (!o) {
                    reset();
                    clearErrors();
                }
            }}
        >
            <DialogTrigger asChild>
                <Button variant="outline">
                    <RefreshCw />
                    Perpanjang
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Perpanjang Gadai</DialogTitle>
                    <DialogDescription>
                        Pelanggan membayar biaya titipan untuk memperpanjang
                        jangka waktu.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-1.5">
                    <Label>Perpanjang</Label>
                    <ToggleGroup
                        type="single"
                        variant="outline"
                        value={data.mode}
                        onValueChange={(v) =>
                            v && setData('mode', v as '15' | '30' | 'custom')
                        }
                        className="w-full"
                    >
                        <ToggleGroupItem
                            value="15"
                            className="h-auto flex-1 flex-col gap-0 py-2"
                        >
                            <span className="font-medium">15 Hari</span>
                            <span className="text-xs text-muted-foreground">
                                biaya {tx.feePercent}%
                            </span>
                        </ToggleGroupItem>
                        <ToggleGroupItem
                            value="30"
                            className="h-auto flex-1 flex-col gap-0 py-2"
                        >
                            <span className="font-medium">30 Hari</span>
                            <span className="text-xs text-muted-foreground">
                                biaya {tx.feePercent}%
                            </span>
                        </ToggleGroupItem>
                        <ToggleGroupItem
                            value="custom"
                            className="h-auto flex-1 flex-col gap-0 py-2"
                        >
                            <span className="font-medium">Custom</span>
                            <span className="text-xs text-muted-foreground">
                                sampai tanggal
                            </span>
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>

                {data.mode === 'custom' && (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="until">Perpanjang sampai</Label>
                            <DatePicker
                                id="until"
                                value={data.until}
                                onChange={(v) => setData('until', v)}
                            />
                            {errors.until && (
                                <p className="text-xs text-destructive">
                                    {errors.until}
                                </p>
                            )}
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="perpanjang-fee">Biaya titipan</Label>
                            <div className="relative">
                                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                                    Rp
                                </span>
                                <Input
                                    id="perpanjang-fee"
                                    inputMode="numeric"
                                    value={
                                        data.fee
                                            ? data.fee.toLocaleString('id-ID')
                                            : ''
                                    }
                                    onChange={(e) =>
                                        setData(
                                            'fee',
                                            parseInt(
                                                e.target.value.replace(
                                                    /\D/g,
                                                    '',
                                                ),
                                                10,
                                            ) || 0,
                                        )
                                    }
                                    placeholder="0"
                                    className="pl-9 tabular-nums"
                                />
                            </div>
                            {errors.fee && (
                                <p className="text-xs text-destructive">
                                    {errors.fee}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                <dl className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
                    <Row
                        label="Biaya titipan (bunga)"
                        value={formatRupiah(fee)}
                        strong
                    />
                    <Row
                        label="Jatuh tempo saat ini"
                        value={formatDate(tx.dueDate)}
                    />
                    <Row
                        label="Jatuh tempo baru"
                        value={formatDate(newDue)}
                        strong
                    />
                </dl>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm">
                    <Checkbox
                        checked={data.fee_paid}
                        onCheckedChange={(v) => setData('fee_paid', v === true)}
                        className="mt-0.5 size-5 border-2 border-muted-foreground/60"
                    />
                    <span>
                        Pelanggan sudah membayar biaya titipan{' '}
                        <span className="font-semibold">
                            {formatRupiah(fee)}
                        </span>
                        . Perpanjangan hanya diproses setelah biaya dibayar.
                    </span>
                </label>
                {errors.fee_paid && (
                    <p className="-mt-1 text-xs text-destructive">
                        {errors.fee_paid}
                    </p>
                )}

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Batal</Button>
                    </DialogClose>
                    <Button
                        onClick={submit}
                        disabled={processing || !data.fee_paid}
                    >
                        <RefreshCw />
                        Konfirmasi Perpanjang
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function TebusDialog({ tx }: { tx: Transaction }) {
    const [open, setOpen] = useState(false);
    const total = tx.principal + tx.fee;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Wallet />
                    Tebus & Ambil
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Tebus & Ambil Barang</DialogTitle>
                    <DialogDescription>
                        Pelanggan membayar total tebus, barang diserahkan dan
                        transaksi ditutup.
                    </DialogDescription>
                </DialogHeader>
                <dl className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
                    <Row
                        label="Dana titipan"
                        value={formatRupiah(tx.principal)}
                    />
                    <Row
                        label={`Biaya titipan (${tx.feePercent}%)`}
                        value={formatRupiah(tx.fee)}
                    />
                    <div className="border-t pt-2">
                        <Row
                            label="Total tebus"
                            value={formatRupiah(total)}
                            strong
                        />
                    </div>
                </dl>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Batal</Button>
                    </DialogClose>
                    <Button
                        onClick={() =>
                            router.post(
                                `/transaksi/${tx.id}/tebus`,
                                {},
                                {
                                    preserveScroll: true,
                                    onSuccess: () => setOpen(false),
                                },
                            )
                        }
                    >
                        <Wallet />
                        Konfirmasi Tebus
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Row({
    label,
    value,
    strong,
}: {
    label: string;
    value: string;
    strong?: boolean;
}) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd
                className={cn(
                    'tabular-nums',
                    strong && 'font-semibold text-foreground',
                )}
            >
                {value}
            </dd>
        </div>
    );
}

function LelangCell({
    label,
    value,
    tone,
}: {
    label: string;
    value: string;
    tone?: string;
}) {
    return (
        <div className="rounded-lg border bg-card/60 p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn('font-semibold tabular-nums', tone)}>{value}</p>
        </div>
    );
}

function RecordSaleDialog({
    tx,
    open,
    onOpenChange,
}: {
    tx: Transaction;
    open: boolean;
    onOpenChange: (value: boolean) => void;
}) {
    const { data, setData, post, processing, errors, reset } = useForm({
        sale_value: 0,
    });

    const net = (data.sale_value || 0) - tx.principal;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(`/transaksi/${tx.id}/sale`, {
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
                        <DialogTitle>Catat Penjualan Lelang</DialogTitle>
                        <DialogDescription>
                            Masukkan harga jual {tx.device.name}. Untung/rugi
                            dihitung dari nilai pinjaman{' '}
                            {formatRupiah(tx.principal)}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-4">
                        <div className="grid gap-1.5">
                            <Label htmlFor="sale-value">Nilai Jual</Label>
                            <div className="relative">
                                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                                    Rp
                                </span>
                                <Input
                                    id="sale-value"
                                    inputMode="numeric"
                                    value={
                                        data.sale_value
                                            ? data.sale_value.toLocaleString(
                                                  'id-ID',
                                              )
                                            : ''
                                    }
                                    onChange={(e) =>
                                        setData(
                                            'sale_value',
                                            parseInt(
                                                e.target.value.replace(
                                                    /\D/g,
                                                    '',
                                                ),
                                                10,
                                            ) || 0,
                                        )
                                    }
                                    placeholder="0"
                                    className="pl-9 text-base font-medium tabular-nums"
                                />
                            </div>
                            {errors.sale_value && (
                                <p className="text-xs text-destructive">
                                    {errors.sale_value}
                                </p>
                            )}
                        </div>
                        {data.sale_value > 0 && (
                            <p className="text-sm text-muted-foreground">
                                {net >= 0 ? 'Keuntungan' : 'Kerugian'}:{' '}
                                <span
                                    className={cn(
                                        'font-semibold tabular-nums',
                                        net >= 0
                                            ? 'text-primary'
                                            : 'text-lelang',
                                    )}
                                >
                                    {formatRupiah(Math.abs(net))}
                                </span>
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">
                                Batal
                            </Button>
                        </DialogClose>
                        <Button
                            type="submit"
                            disabled={processing || data.sale_value <= 0}
                        >
                            <Coins />
                            Simpan Penjualan
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

TransaksiShow.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Transaksi', href: '/transaksi' },
        { title: 'Detail', href: '/transaksi' },
    ],
};
