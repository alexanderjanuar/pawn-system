import { Head, router } from '@inertiajs/react';
import type { CashFlow } from '@/components/gadai/cash-flow-panel';
import { CashFlowPanel } from '@/components/gadai/cash-flow-panel';
import { DateRangeFilter } from '@/components/gadai/date-range-filter';
import { PageHeader } from '@/components/gadai/page-header';
import { formatDate } from '@/lib/format';

type Period = { from: string; to: string };

export default function Kas({
    period,
    cashFlow,
}: {
    period: Period;
    cashFlow: CashFlow;
}) {
    const periodLabel =
        period.from || period.to
            ? `${period.from ? formatDate(period.from) : '—'} – ${period.to ? formatDate(period.to) : '—'}`
            : 'Semua tanggal';

    return (
        <>
            <Head title="Kas Harian" />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <PageHeader
                    title="Kas Harian"
                    description="Uang masuk & keluar untuk dicocokkan dengan uang di laci. Default menampilkan hari ini."
                />

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
