import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    CalendarDays,
    ChevronRight,
    FileSpreadsheet,
    FileText,
    Gavel,
    Package,
    Receipt,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { BarChart } from '@/components/gadai/bar-chart';
import { DateRangeFilter } from '@/components/gadai/date-range-filter';
import { DonutChart } from '@/components/gadai/donut-chart';
import { IncomeInfo } from '@/components/gadai/income-info';
import { PageHeader } from '@/components/gadai/page-header';
import { PetugasLink } from '@/components/petugas-link';
import { StatusBadge } from '@/components/status-badge';
import { TablePagination } from '@/components/table-pagination';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { usePagination } from '@/hooks/use-pagination';
import { formatDate, formatRupiah } from '@/lib/format';
import { STATUS_META, STATUS_ORDER } from '@/lib/gadai';
import { buildReport } from '@/lib/report';
import { countByStatus } from '@/lib/selectors';
import { cn, initials } from '@/lib/utils';
import type { Transaction } from '@/types/gadai';

type Period = { from: string; to: string };
type TrendPoint = {
    label: string;
    title?: string;
    value: number;
    current: boolean;
    /** Month boundaries, present on the monthly trend so a bar can be clicked. */
    from?: string;
    to?: string;
};
type FeeIncomeEntry = {
    id: number;
    code: string | null;
    customer: string;
    kind: 'perpanjang' | 'tebus';
    amount: number;
    date: string;
    time: string | null;
    clerk: string;
};
type FeeIncome = {
    perpanjang: number;
    tebus: number;
    total: number;
    entries: FeeIncomeEntry[];
};
type Overview = {
    uangBeredar: number;
    barangAktif: number;
    lewatTempo: number;
    lelang: number;
};
type CardData = {
    label: string;
    value: string;
    hint: string;
    icon: typeof Wallet;
    tone?: string;
    highlight?: boolean;
    info?: ReactNode;
};

/** Small heading above a group of stat cards, with an optional period chip. */
function BlockHead({
    title,
    note,
    chip,
}: {
    title: string;
    note?: string;
    chip?: string;
}) {
    return (
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
            <h2 className="text-sm font-semibold">
                {title}
                {note && (
                    <span className="ml-1.5 font-normal text-muted-foreground">
                        · {note}
                    </span>
                )}
            </h2>
            {chip && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                    {chip}
                </span>
            )}
        </div>
    );
}

/** One metric card. `highlight` makes it the visual anchor of its group. */
function StatCard({
    label,
    value,
    hint,
    icon: Icon,
    tone,
    highlight,
    info,
}: CardData) {
    return (
        <div
            className={cn(
                'flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-4 shadow-sm sm:p-5',
                highlight && 'border-primary/25 bg-primary/[0.04]',
            )}
        >
            <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <Icon className="size-3.5 shrink-0" />
                <span className="truncate">{label}</span>
                {info}
            </span>
            <span
                className={cn(
                    'truncate font-semibold tabular-nums',
                    highlight
                        ? 'text-xl sm:text-2xl'
                        : 'text-base sm:text-lg lg:text-xl',
                    tone,
                )}
            >
                {value}
            </span>
            <span className="text-xs text-muted-foreground">{hint}</span>
        </div>
    );
}

export default function Laporan({
    transactions,
    period,
    trend,
    dailyTrend,
    overview,
    feeIncome,
}: {
    transactions: Transaction[];
    period: Period;
    trend: TrendPoint[];
    dailyTrend: TrendPoint[];
    overview: Overview;
    feeIncome: FeeIncome;
}) {
    const report = useMemo(() => buildReport(transactions), [transactions]);

    const [activeClerk, setActiveClerk] = useState<string | null>(null);
    const rincian = usePagination(transactions, 10);
    const feeRincian = usePagination(feeIncome.entries, 10);

    const statusSegments = report.perStatus.map((row) => ({
        label: STATUS_META[row.status].label,
        value: row.count,
        sub: formatRupiah(row.principal),
        colorClassName: STATUS_META[row.status].text,
    }));

    // Angka yang MENGIKUTI filter tanggal.
    const periodeCards: CardData[] = [
        {
            label: 'Keuntungan',
            value: formatRupiah(feeIncome.total),
            hint: `Perpanjang ${formatRupiah(feeIncome.perpanjang)} · Tebus ${formatRupiah(feeIncome.tebus)}`,
            icon: TrendingUp,
            tone: 'text-primary',
            highlight: true,
            info: <IncomeInfo />,
        },
        {
            label: 'Total Pinjaman Cair',
            value: formatRupiah(report.danaTersalurkan),
            hint: `rata-rata ${formatRupiah(report.avgPrincipal)}/transaksi`,
            icon: Wallet,
        },
        {
            label: 'Jumlah Transaksi',
            value: String(report.total),
            hint: `${report.ditebus} ditebus · ${report.lelang} lelang`,
            icon: Receipt,
        },
    ];

    // Angka SNAPSHOT (kondisi sekarang, lepas dari filter tanggal).
    const kondisiCards: CardData[] = [
        {
            label: 'Uang di Pelanggan',
            value: formatRupiah(overview.uangBeredar),
            hint: 'dana titipan belum ditebus',
            icon: Wallet,
        },
        {
            label: 'Barang Aktif',
            value: String(overview.barangAktif),
            hint: 'gadai sedang berjalan',
            icon: Package,
        },
        {
            label: 'Lewat Jatuh Tempo',
            value: String(overview.lewatTempo),
            hint: 'perlu segera ditindak',
            icon: AlertTriangle,
            tone: 'text-overdue',
        },
        {
            label: 'Barang Lelang',
            value: String(overview.lelang),
            hint: 'ditandai untuk lelang',
            icon: Gavel,
            tone: 'text-lelang',
        },
    ];

    const params = new URLSearchParams({
        from: period.from,
        to: period.to,
    }).toString();

    const periodLabel =
        period.from || period.to
            ? `${period.from ? formatDate(period.from) : '—'} – ${period.to ? formatDate(period.to) : '—'}`
            : 'Semua tanggal';

    const applyPeriod = (from: string, to: string) =>
        router.get(
            '/laporan',
            { from, to },
            { preserveScroll: true, replace: true },
        );

    // Highlight the bar that matches the period being viewed, so the chart and
    // the figure beside it always tell the same story.
    const monthlyTrend = trend.map((point) => ({
        ...point,
        current: point.from === period.from && point.to === period.to,
    }));

    const selectedMonth = monthlyTrend.findIndex((point) => point.current);

    return (
        <>
            <Head title="Laporan" />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <PageHeader
                    title="Laporan"
                    description="Ringkasan transaksi, pemasukan biaya titipan, dan barang per status."
                >
                    <Button variant="outline" asChild>
                        <Link href="/laporan/lelang">
                            <Gavel />
                            Barang Lelang
                        </Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <a href={`/laporan/export?${params}`}>
                            <FileSpreadsheet />
                            Excel
                        </a>
                    </Button>
                    <Button variant="outline" asChild>
                        <a
                            href={`/laporan/cetak?${params}`}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <FileText />
                            PDF
                        </a>
                    </Button>
                </PageHeader>

                {/* Filter periode — mengatur blok "Periode Ini" di bawah */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <DateRangeFilter
                        from={period.from}
                        to={period.to}
                        idPrefix="lap"
                        onChange={applyPeriod}
                    />
                    <p className="text-sm text-muted-foreground sm:text-right">
                        <span className="font-medium text-foreground tabular-nums">
                            {report.total}
                        </span>{' '}
                        transaksi pada periode ini
                    </p>
                </div>

                {/* Blok 1 — Periode Ini (ikut filter tanggal) */}
                <div className="flex flex-col gap-3">
                    <BlockHead
                        title="Periode Ini"
                        note="mengikuti filter tanggal"
                        chip={periodLabel}
                    />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {periodeCards.map((c) => (
                            <StatCard key={c.label} {...c} />
                        ))}
                    </div>
                </div>

                {/* Blok 2 — Kondisi Sekarang (snapshot, lepas dari filter) */}
                <div className="flex flex-col gap-3">
                    <BlockHead
                        title="Kondisi Sekarang"
                        note="tidak terpengaruh filter tanggal"
                    />
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        {kondisiCards.map((c) => (
                            <StatCard key={c.label} {...c} />
                        ))}
                    </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-5">
                    {/* Fee income + trend */}
                    <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-6 lg:col-span-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="flex items-center gap-2 font-semibold">
                                    <TrendingUp className="size-4 text-primary" />
                                    Tren Keuntungan
                                    <IncomeInfo />
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    Biaya titipan · klik batang bulan untuk
                                    melihat rinciannya
                                </p>
                            </div>
                            <div className="shrink-0 text-right">
                                <p className="text-lg font-semibold text-primary tabular-nums">
                                    {formatRupiah(feeIncome.total)}
                                </p>
                                <p className="text-xs whitespace-nowrap text-muted-foreground">
                                    {periodLabel}
                                </p>
                                <p className="text-xs whitespace-nowrap text-muted-foreground">
                                    Perpanjang{' '}
                                    {formatRupiah(feeIncome.perpanjang)} · Tebus{' '}
                                    {formatRupiah(feeIncome.tebus)}
                                </p>
                            </div>
                        </div>

                        {/* Month navigation, so the figure above is never from
                            a month the user did not mean to be looking at. */}
                        <div className="mt-4 flex flex-wrap items-center gap-1.5">
                            {monthlyTrend.map((point, i) => (
                                <button
                                    key={point.from ?? i}
                                    type="button"
                                    onClick={() =>
                                        point.from &&
                                        point.to &&
                                        applyPeriod(point.from, point.to)
                                    }
                                    className={cn(
                                        'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                                        point.current
                                            ? 'border-transparent bg-primary text-primary-foreground'
                                            : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                                    )}
                                >
                                    {point.title ?? point.label}
                                </button>
                            ))}
                            {selectedMonth === -1 && (
                                <span className="px-1 text-xs text-muted-foreground">
                                    periode custom
                                </span>
                            )}
                        </div>

                        {/* trend */}
                        <div className="mt-4">
                            <BarChart
                                data={monthlyTrend}
                                onSelect={(i) => {
                                    const point = monthlyTrend[i];

                                    if (point.from && point.to) {
                                        applyPeriod(point.from, point.to);
                                    }
                                }}
                            />
                        </div>
                    </section>

                    {/* Per status */}
                    <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-6 lg:col-span-2">
                        <h2 className="font-semibold">Barang per Status</h2>
                        <p className="mb-4 text-xs text-muted-foreground">
                            Jumlah & dana per status pada periode
                        </p>
                        <DonutChart
                            segments={statusSegments}
                            centerLabel="Barang"
                        />
                    </section>
                </div>

                {/* Rincian pembayaran biaya: perpanjang & tebus */}
                <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
                        <div>
                            <h2 className="flex items-center gap-2 font-semibold">
                                <TrendingUp className="size-4 text-primary" />
                                Rincian Pemasukan Biaya
                                <IncomeInfo />
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                Bunga yang dibayar · Tebus dihitung bunganya
                                saja (tanpa pokok). Beda dengan Kas Harian yang
                                menghitung uang fisik.
                            </p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                            {feeIncome.entries.length} pembayaran
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[46rem] text-sm">
                            <thead>
                                <tr className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
                                    <th className="px-5 py-3 font-medium">
                                        Waktu
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Kode
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Pelanggan
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Jenis
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Petugas
                                    </th>
                                    <th className="px-5 py-3 text-right font-medium">
                                        Bunga
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {feeRincian.pageItems.length > 0 ? (
                                    feeRincian.pageItems.map((e) => {
                                        const meta =
                                            e.kind === 'perpanjang'
                                                ? STATUS_META.PERPANJANG
                                                : STATUS_META.DIAMBIL;

                                        return (
                                            <tr
                                                key={e.id}
                                                className="transition-colors hover:bg-accent"
                                            >
                                                <td className="px-5 py-3 whitespace-nowrap text-muted-foreground tabular-nums">
                                                    {formatDate(e.date)}
                                                    {e.time
                                                        ? ` · ${e.time}`
                                                        : ''}
                                                </td>
                                                <td className="px-5 py-3">
                                                    {e.code ? (
                                                        <Link
                                                            href={`/transaksi/${e.code}`}
                                                            className="font-medium tabular-nums hover:text-primary hover:underline"
                                                        >
                                                            {e.code}
                                                        </Link>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                                <td className="px-5 py-3">
                                                    {e.customer}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span
                                                        className={cn(
                                                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                                                            meta.badge,
                                                            meta.ring,
                                                        )}
                                                    >
                                                        {e.kind === 'perpanjang'
                                                            ? 'Perpanjang'
                                                            : 'Tebus'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <PetugasLink
                                                        name={e.clerk}
                                                    />
                                                </td>
                                                <td className="px-5 py-3 text-right font-medium text-primary tabular-nums">
                                                    +{formatRupiah(e.amount)}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-5 py-10 text-center text-muted-foreground"
                                        >
                                            Belum ada pembayaran biaya pada
                                            periode ini.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {feeIncome.entries.length > 0 && (
                        <TablePagination
                            page={feeRincian.page}
                            totalPages={feeRincian.totalPages}
                            pageSize={feeRincian.pageSize}
                            total={feeRincian.total}
                            from={feeRincian.from}
                            to={feeRincian.to}
                            onPageChange={feeRincian.setPage}
                            onPageSizeChange={feeRincian.setPageSize}
                        />
                    )}
                </section>

                {/* Grafik harian */}
                <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="flex items-center gap-2 font-semibold">
                                <CalendarDays className="size-4 text-muted-foreground" />
                                Grafik Harian
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                Dana disalurkan · 14 hari terakhir
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-semibold tabular-nums">
                                {formatRupiah(
                                    dailyTrend.reduce((s, d) => s + d.value, 0),
                                )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                14 hari terakhir
                            </p>
                        </div>
                    </div>
                    <div className="mt-6">
                        <BarChart data={dailyTrend} showValues={false} />
                    </div>
                </section>

                {/* Per petugas */}
                <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div className="border-b px-5 py-4">
                        <h2 className="font-semibold">Ringkasan per Petugas</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[36rem] text-sm">
                            <thead>
                                <tr className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
                                    <th className="px-5 py-3 font-medium">
                                        Petugas
                                    </th>
                                    <th className="px-5 py-3 text-right font-medium">
                                        Transaksi
                                    </th>
                                    <th className="px-5 py-3 text-right font-medium">
                                        Dana Tersalurkan
                                    </th>
                                    <th className="px-5 py-3 text-right font-medium">
                                        Biaya Titipan
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {report.clerks.length > 0 ? (
                                    report.clerks.map((c) => (
                                        <tr
                                            key={c.clerk}
                                            onClick={() =>
                                                setActiveClerk(c.clerk)
                                            }
                                            className="group cursor-pointer transition-colors hover:bg-accent"
                                        >
                                            <td className="px-5 py-3 font-medium">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <PetugasLink
                                                        name={c.clerk}
                                                    />
                                                    <ChevronRight className="size-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-right tabular-nums">
                                                {c.count}
                                            </td>
                                            <td className="px-5 py-3 text-right tabular-nums">
                                                {formatRupiah(c.dana)}
                                            </td>
                                            <td className="px-5 py-3 text-right tabular-nums">
                                                {formatRupiah(c.biaya)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="px-5 py-8 text-center text-muted-foreground"
                                        >
                                            Tidak ada data pada periode ini.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <ClerkDetailDialog
                    clerk={activeClerk}
                    transactions={transactions}
                    open={activeClerk !== null}
                    onOpenChange={(v) => {
                        if (!v) {
                            setActiveClerk(null);
                        }
                    }}
                />

                {/* Rincian transaksi */}
                <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
                        <h2 className="flex items-center gap-2 font-semibold">
                            <Receipt className="size-4 text-muted-foreground" />
                            Rincian Transaksi
                        </h2>
                        <span className="text-xs text-muted-foreground">
                            {report.total} baris
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[52rem] text-sm">
                            <thead>
                                <tr className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
                                    <th className="px-5 py-3 font-medium">
                                        Kode
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Pelanggan
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Barang
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Status
                                    </th>
                                    <th className="px-5 py-3 text-right font-medium">
                                        Dana
                                    </th>
                                    <th className="px-5 py-3 text-right font-medium">
                                        Biaya
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {rincian.pageItems.length > 0 ? (
                                    rincian.pageItems.map((t) => (
                                        <tr
                                            key={t.id}
                                            className="transition-colors hover:bg-accent"
                                        >
                                            <td className="px-5 py-3">
                                                <Link
                                                    href={`/transaksi/${t.id}`}
                                                    className="font-medium tabular-nums hover:text-primary hover:underline"
                                                >
                                                    {t.id}
                                                </Link>
                                                <div className="text-xs text-muted-foreground tabular-nums">
                                                    {formatDate(t.startDate)}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3">
                                                {t.customer.name}
                                            </td>
                                            <td className="px-5 py-3 text-muted-foreground">
                                                {t.device.name}
                                            </td>
                                            <td className="px-5 py-3">
                                                <StatusBadge
                                                    status={t.status}
                                                    size="sm"
                                                />
                                            </td>
                                            <td className="px-5 py-3 text-right font-medium tabular-nums">
                                                {formatRupiah(t.principal)}
                                            </td>
                                            <td className="px-5 py-3 text-right text-muted-foreground tabular-nums">
                                                {formatRupiah(t.fee)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-5 py-12 text-center text-muted-foreground"
                                        >
                                            Tidak ada transaksi pada periode
                                            ini.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <TablePagination
                        page={rincian.page}
                        totalPages={rincian.totalPages}
                        pageSize={rincian.pageSize}
                        total={rincian.total}
                        from={rincian.from}
                        to={rincian.to}
                        onPageChange={rincian.setPage}
                        onPageSizeChange={rincian.setPageSize}
                    />
                </section>
            </div>
        </>
    );
}

function ClerkDetailDialog({
    clerk,
    transactions,
    open,
    onOpenChange,
}: {
    clerk: string | null;
    transactions: Transaction[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const txs = useMemo(
        () => (clerk ? transactions.filter((t) => t.clerk === clerk) : []),
        [clerk, transactions],
    );

    const dana = txs.reduce((s, t) => s + t.principal, 0);
    const biaya = txs.reduce((s, t) => s + t.fee, 0);
    const avg = txs.length ? Math.round(dana / txs.length) : 0;
    const counts = countByStatus(txs);

    const stats = [
        { label: 'Transaksi', value: String(txs.length) },
        { label: 'Dana Tersalurkan', value: formatRupiah(dana) },
        {
            label: 'Biaya Titipan',
            value: formatRupiah(biaya),
            tone: 'text-primary',
        },
        { label: 'Rata-rata Dana', value: formatRupiah(avg) },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl lg:max-w-5xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground/80">
                            {clerk ? initials(clerk) : '—'}
                        </span>
                        {clerk ?? 'Petugas'}
                    </DialogTitle>
                    <DialogDescription>
                        Rincian transaksi yang ditangani pada periode ini.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {stats.map((s) => (
                        <div
                            key={s.label}
                            className="rounded-lg border bg-muted/30 p-3"
                        >
                            <p className="text-xs text-muted-foreground">
                                {s.label}
                            </p>
                            <p
                                className={cn(
                                    'font-semibold tabular-nums',
                                    s.tone,
                                )}
                            >
                                {s.value}
                            </p>
                        </div>
                    ))}
                </div>

                {txs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {STATUS_ORDER.filter((st) => counts[st] > 0).map(
                            (st) => (
                                <span
                                    key={st}
                                    className={cn(
                                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
                                        STATUS_META[st].badge,
                                        STATUS_META[st].ring,
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'size-1.5 rounded-full',
                                            STATUS_META[st].dot,
                                        )}
                                        aria-hidden
                                    />
                                    {STATUS_META[st].label} · {counts[st]}
                                </span>
                            ),
                        )}
                    </div>
                )}

                <div className="max-h-[26rem] overflow-auto rounded-lg border">
                    <table className="w-full min-w-[34rem] text-sm">
                        <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                                <th className="px-3 py-2 font-medium">Kode</th>
                                <th className="px-3 py-2 font-medium">
                                    Tanggal
                                </th>
                                <th className="px-3 py-2 font-medium">
                                    Pelanggan
                                </th>
                                <th className="px-3 py-2 font-medium">
                                    Status
                                </th>
                                <th className="px-3 py-2 text-right font-medium">
                                    Dana
                                </th>
                                <th className="px-3 py-2">
                                    <span className="sr-only">Aksi</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {txs.map((t) => (
                                <tr
                                    key={t.id}
                                    onClick={() =>
                                        router.visit(`/transaksi/${t.id}`)
                                    }
                                    className="group cursor-pointer transition-colors hover:bg-accent"
                                >
                                    <td className="px-3 py-2">
                                        <div className="font-medium tabular-nums transition-colors group-hover:text-primary">
                                            {t.id}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {t.device.name}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground tabular-nums">
                                        {formatDate(t.startDate)}
                                    </td>
                                    <td className="px-3 py-2">
                                        {t.customer.name}
                                    </td>
                                    <td className="px-3 py-2">
                                        <StatusBadge
                                            status={t.status}
                                            size="sm"
                                        />
                                    </td>
                                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                                        {formatRupiah(t.principal)}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            asChild
                                            className="h-7 gap-1 px-2 text-xs text-muted-foreground group-hover:text-primary"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Link href={`/transaksi/${t.id}`}>
                                                Detail
                                                <ChevronRight className="size-3.5" />
                                            </Link>
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DialogContent>
        </Dialog>
    );
}

Laporan.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Laporan', href: '/laporan' },
    ],
};
