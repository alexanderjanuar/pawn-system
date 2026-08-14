import { Head, router, usePage } from '@inertiajs/react';
import { Copy, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { CashFlow } from '@/components/gadai/cash-flow-panel';
import { CashFlowPanel } from '@/components/gadai/cash-flow-panel';
import { DateRangeFilter } from '@/components/gadai/date-range-filter';
import { PageHeader } from '@/components/gadai/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDate } from '@/lib/format';
import { buildKasReport } from '@/lib/kas-report';

type Period = { from: string; to: string };

export default function Kas({
    period,
    cashFlow,
}: {
    period: Period;
    cashFlow: CashFlow;
}) {
    const props = usePage().props;
    const shopName =
        props.activeStoreName && props.activeStoreName !== 'Semua Toko'
            ? props.activeStoreName
            : 'Gulam Cell';

    const [saldo, setSaldo] = useState('');
    const saldoNum = saldo ? parseInt(saldo.replace(/\D/g, ''), 10) || 0 : null;

    const periodLabel =
        period.from || period.to
            ? `${period.from ? formatDate(period.from) : '—'} – ${period.to ? formatDate(period.to) : '—'}`
            : 'Semua tanggal';
    const reportDate =
        period.from && period.from === period.to
            ? formatDate(period.from)
            : periodLabel;

    const copyReport = () => {
        const text = buildKasReport(cashFlow, reportDate, shopName, saldoNum);
        navigator.clipboard
            .writeText(text)
            .then(() =>
                toast.success('Laporan disalin', {
                    description: 'Tinggal tempel di WhatsApp.',
                }),
            )
            .catch(() => toast.error('Gagal menyalin. Coba lagi.'));
    };

    const exportUrl = (() => {
        const params = new URLSearchParams({
            from: period.from,
            to: period.to,
            shop: shopName,
        });

        if (saldoNum) {
            params.set('saldo', String(saldoNum));
        }

        return `/kas/export?${params.toString()}`;
    })();

    return (
        <>
            <Head title="Kas Harian" />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <PageHeader
                    title="Kas Harian"
                    description="Uang masuk & keluar untuk dicocokkan dengan uang di laci. Default menampilkan hari ini."
                >
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
                    <div className="flex flex-wrap items-end gap-3">
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
                        <div className="grid gap-1.5">
                            <Label htmlFor="saldo-awal">
                                Saldo awal (opsional)
                            </Label>
                            <div className="relative">
                                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                                    Rp
                                </span>
                                <Input
                                    id="saldo-awal"
                                    inputMode="numeric"
                                    value={
                                        saldoNum
                                            ? saldoNum.toLocaleString('id-ID')
                                            : ''
                                    }
                                    onChange={(e) => setSaldo(e.target.value)}
                                    placeholder="0"
                                    className="w-40 pl-9 tabular-nums"
                                />
                            </div>
                        </div>
                    </div>
                    <p className="text-sm text-muted-foreground sm:text-right">
                        {periodLabel}
                    </p>
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

Kas.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Kas Harian', href: '/kas' },
    ],
};
