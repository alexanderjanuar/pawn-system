import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    Banknote,
    Copy,
    FileSpreadsheet,
    Landmark,
    Plus,
    Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { CashFlow } from '@/components/gadai/cash-flow-panel';
import { CashFlowPanel } from '@/components/gadai/cash-flow-panel';
import { DatePicker } from '@/components/gadai/date-picker';
import { DateRangeFilter } from '@/components/gadai/date-range-filter';
import { PageHeader } from '@/components/gadai/page-header';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatDate, formatRupiah } from '@/lib/format';
import { buildKasReport } from '@/lib/kas-report';
import { cn } from '@/lib/utils';

type Period = { from: string; to: string };

export default function Kas({
    period,
    cashFlow,
    saldoAwal,
}: {
    period: Period;
    cashFlow: CashFlow;
    saldoAwal: number | null;
}) {
    const props = usePage().props;
    const shopName =
        props.activeStoreName && props.activeStoreName !== 'Semua Toko'
            ? props.activeStoreName
            : 'Gulam Cell';

    const kasAkhir = saldoAwal !== null ? saldoAwal + cashFlow.net : null;

    const periodLabel =
        period.from || period.to
            ? `${period.from ? formatDate(period.from) : '—'} – ${period.to ? formatDate(period.to) : '—'}`
            : 'Semua tanggal';
    const reportDate =
        period.from && period.from === period.to
            ? formatDate(period.from)
            : periodLabel;

    const copyReport = () => {
        const text = buildKasReport(cashFlow, reportDate, shopName, saldoAwal);
        navigator.clipboard
            .writeText(text)
            .then(() =>
                toast.success('Laporan disalin', {
                    description: 'Tinggal tempel di WhatsApp.',
                }),
            )
            .catch(() => toast.error('Gagal menyalin. Coba lagi.'));
    };

    const exportUrl = `/kas/export?${new URLSearchParams({
        from: period.from,
        to: period.to,
        shop: shopName,
    }).toString()}`;

    return (
        <>
            <Head title="Kas Harian" />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <PageHeader
                    title="Kas Harian"
                    description="Uang masuk & keluar untuk dicocokkan dengan uang di laci. Default menampilkan hari ini."
                >
                    <ManualEntryDialog period={period} />
                    <SaldoDialog period={period} kasAkhir={kasAkhir} />
                    <Button variant="outline" onClick={copyReport}>
                        <Copy />
                        Salin WhatsApp
                    </Button>
                    <Button variant="outline" asChild>
                        <a href={exportUrl}>
                            <FileSpreadsheet />
                            Unduh Excel
                        </a>
                    </Button>
                </PageHeader>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <DateRangeFilter
                        from={period.from}
                        to={period.to}
                        idPrefix="kas"
                        onChange={(from, to) =>
                            router.get(
                                '/kas',
                                { from, to },
                                { preserveScroll: true, replace: true },
                            )
                        }
                    />
                    <p className="text-sm text-muted-foreground sm:text-right">
                        {periodLabel}
                    </p>
                </div>

                {/* Saldo kas: awal (tersimpan) + kas akhir sistem */}
                <div className="grid grid-cols-1 divide-y rounded-xl border bg-card shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                    <div className="flex flex-col gap-1 p-4 sm:p-5">
                        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            Saldo Awal
                        </span>
                        {saldoAwal !== null ? (
                            <span className="text-lg font-semibold tabular-nums sm:text-xl">
                                {formatRupiah(saldoAwal)}
                            </span>
                        ) : (
                            <span className="text-sm text-muted-foreground">
                                Belum diatur — klik "Atur Saldo Kas"
                            </span>
                        )}
                    </div>
                    <div className="flex flex-col gap-1 p-4 sm:p-5">
                        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            Kas Bersih
                        </span>
                        <span
                            className={cn(
                                'text-lg font-semibold tabular-nums sm:text-xl',
                                cashFlow.net >= 0
                                    ? 'text-primary'
                                    : 'text-overdue',
                            )}
                        >
                            {cashFlow.net >= 0 ? '+' : '−'}
                            {formatRupiah(Math.abs(cashFlow.net))}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            uang masuk − keluar
                        </span>
                    </div>
                    <div className="flex flex-col gap-1 p-4 sm:p-5">
                        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            Kas Akhir (sistem)
                        </span>
                        {kasAkhir !== null ? (
                            <span className="text-lg font-semibold tabular-nums sm:text-xl">
                                {formatRupiah(kasAkhir)}
                            </span>
                        ) : (
                            <span className="text-sm text-muted-foreground">
                                —
                            </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                            seharusnya di laci
                        </span>
                    </div>
                </div>

                <CashFlowPanel
                    cashFlow={cashFlow}
                    periodLabel={periodLabel}
                    title="Kas"
                />
            </div>
        </>
    );
}

/** Record a manual cash movement (typically an operational expense). */
function ManualEntryDialog({ period }: { period: Period }) {
    const [open, setOpen] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        direction: 'out' as 'in' | 'out',
        amount: 0,
        description: '',
        method: 'cash' as 'cash' | 'transfer',
        date: period.from || '',
    });

    const submit = () =>
        post('/kas/manual', {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                reset();
            },
        });

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);

                if (!next) {
                    reset();
                }
            }}
        >
            <DialogTrigger asChild>
                <Button>
                    <Plus />
                    Tambah Kas Manual
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Tambah Kas Manual</DialogTitle>
                    <DialogDescription>
                        Catat uang keluar (mis. beli ATK, bayar listrik) atau
                        uang masuk lain yang tidak dari gadai. Ikut dihitung di
                        rekonsiliasi kas.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    <div className="grid gap-1.5">
                        <Label>Jenis</Label>
                        <ToggleGroup
                            type="single"
                            variant="outline"
                            value={data.direction}
                            onValueChange={(v) =>
                                v && setData('direction', v as 'in' | 'out')
                            }
                            className="w-full"
                        >
                            <ToggleGroupItem
                                value="out"
                                className="flex-1 data-[state=on]:bg-overdue-soft data-[state=on]:text-overdue"
                            >
                                Keluar
                            </ToggleGroupItem>
                            <ToggleGroupItem
                                value="in"
                                className="flex-1 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
                            >
                                Masuk
                            </ToggleGroupItem>
                        </ToggleGroup>
                    </div>

                    <div className="grid gap-1.5">
                        <Label htmlFor="manual-desc">Keterangan</Label>
                        <Input
                            id="manual-desc"
                            value={data.description}
                            onChange={(e) =>
                                setData('description', e.target.value)
                            }
                            placeholder="mis. Beli materai, bensin, bayar listrik"
                            maxLength={120}
                        />
                        {errors.description && (
                            <p className="text-xs text-destructive">
                                {errors.description}
                            </p>
                        )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="manual-amount">Jumlah</Label>
                            <div className="relative">
                                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                                    Rp
                                </span>
                                <Input
                                    id="manual-amount"
                                    inputMode="numeric"
                                    value={
                                        data.amount
                                            ? data.amount.toLocaleString('id-ID')
                                            : ''
                                    }
                                    onChange={(e) =>
                                        setData(
                                            'amount',
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
                            {errors.amount && (
                                <p className="text-xs text-destructive">
                                    {errors.amount}
                                </p>
                            )}
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="manual-date">Tanggal</Label>
                            <DatePicker
                                id="manual-date"
                                value={data.date}
                                onChange={(v) => setData('date', v)}
                            />
                            {errors.date && (
                                <p className="text-xs text-destructive">
                                    {errors.date}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-1.5">
                        <Label>Metode</Label>
                        <ToggleGroup
                            type="single"
                            variant="outline"
                            value={data.method}
                            onValueChange={(v) =>
                                v && setData('method', v as 'cash' | 'transfer')
                            }
                            className="w-full"
                        >
                            <ToggleGroupItem value="cash" className="flex-1">
                                <Banknote className="size-4 text-primary" />
                                Tunai
                            </ToggleGroupItem>
                            <ToggleGroupItem value="transfer" className="flex-1">
                                <Landmark className="size-4 text-aktif" />
                                Transfer
                            </ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                </div>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Batal</Button>
                    </DialogClose>
                    <Button
                        onClick={submit}
                        disabled={
                            processing ||
                            data.amount <= 0 ||
                            !data.description.trim() ||
                            !data.date
                        }
                    >
                        <Plus />
                        Simpan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Set or reconcile the persistent physical cash balance. */
function SaldoDialog({
    period,
    kasAkhir,
}: {
    period: Period;
    kasAkhir: number | null;
}) {
    const [open, setOpen] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        amount: 0,
        date: period.from || '',
    });

    const selisih = kasAkhir !== null ? data.amount - kasAkhir : null;

    const submit = () =>
        post('/kas/saldo', {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                reset();
            },
        });

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);

                if (!next) {
                    reset();
                }
            }}
        >
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Wallet />
                    Atur Saldo Kas
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Atur Saldo Kas</DialogTitle>
                    <DialogDescription>
                        Isi uang kas fisik sebagai saldo di awal tanggal
                        tersebut. Dipakai sekali saat mulai, dan bisa dikoreksi
                        saat rekonsiliasi. Sistem menghitung kas berjalan dari
                        sini.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                        <Label htmlFor="saldo-amount">Saldo kas fisik</Label>
                        <div className="relative">
                            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                                Rp
                            </span>
                            <Input
                                id="saldo-amount"
                                inputMode="numeric"
                                value={
                                    data.amount
                                        ? data.amount.toLocaleString('id-ID')
                                        : ''
                                }
                                onChange={(e) =>
                                    setData(
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
                        {errors.amount && (
                            <p className="text-xs text-destructive">
                                {errors.amount}
                            </p>
                        )}
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="saldo-date">Berlaku dari tanggal</Label>
                        <DatePicker
                            id="saldo-date"
                            value={data.date}
                            onChange={(v) => setData('date', v)}
                        />
                        {errors.date && (
                            <p className="text-xs text-destructive">
                                {errors.date}
                            </p>
                        )}
                    </div>
                </div>

                {kasAkhir !== null && (
                    <dl className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
                        <div className="flex items-baseline justify-between gap-3">
                            <dt className="text-muted-foreground">
                                Kas sistem saat ini
                            </dt>
                            <dd className="tabular-nums">
                                {formatRupiah(kasAkhir)}
                            </dd>
                        </div>
                        {data.amount > 0 && selisih !== null && (
                            <div className="flex items-baseline justify-between gap-3">
                                <dt className="text-muted-foreground">
                                    Selisih (fisik − sistem)
                                </dt>
                                <dd
                                    className={cn(
                                        'font-semibold tabular-nums',
                                        selisih === 0
                                            ? 'text-primary'
                                            : 'text-overdue',
                                    )}
                                >
                                    {selisih >= 0 ? '+' : '−'}
                                    {formatRupiah(Math.abs(selisih))}
                                </dd>
                            </div>
                        )}
                    </dl>
                )}

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Batal</Button>
                    </DialogClose>
                    <Button
                        onClick={submit}
                        disabled={processing || data.amount <= 0 || !data.date}
                    >
                        <Wallet />
                        Simpan Saldo
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

Kas.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Kas Harian', href: '/kas' },
    ],
};
