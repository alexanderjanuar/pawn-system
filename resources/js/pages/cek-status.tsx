import { Head, router } from '@inertiajs/react';
import { Info, PackageSearch, Search, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { daysUntil, dueLabel, formatDate, formatRupiah } from '@/lib/format';
import { STATUS_META } from '@/lib/gadai';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/types/gadai';

export default function CekStatus({
    result,
    searched,
    query,
}: {
    result: Transaction | null;
    searched: boolean;
    query: { kode: string; hp: string };
}) {
    const [kode, setKode] = useState(query.kode ?? '');
    const [phone, setPhone] = useState(query.hp ?? '');

    // Arrived via the nota QR (code prefilled) but no phone yet.
    const prefilledFromQr = !!query.kode && !query.hp;

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        router.get(
            '/cek-status',
            { kode: kode.trim(), hp: phone.trim() },
            { preserveScroll: true },
        );
    };

    return (
        <>
            <Head title="Cek Status Gadai — Gulam Cell II" />
            <div className="flex min-h-svh flex-col bg-background">
                <header className="border-b">
                    <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-4">
                        <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                            <AppLogoIcon className="size-5" />
                        </span>
                        <div className="leading-tight">
                            <p className="font-semibold">Gulam Cell II</p>
                            <p className="text-xs text-muted-foreground">
                                Jl. Serayu Tanah Merah No. 57
                            </p>
                        </div>
                    </div>
                </header>

                <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 sm:py-12">
                    <div className="space-y-2">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Cek Status Gadai
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Masukkan kode transaksi dan nomor HP untuk melihat
                            status barang, dana titipan, dan tanggal jatuh
                            tempo, tanpa perlu datang ke counter.
                        </p>
                    </div>

                    <form
                        onSubmit={onSubmit}
                        className="rounded-xl border bg-card p-5 shadow-sm sm:p-6"
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-1.5">
                                <Label htmlFor="kode">Kode transaksi</Label>
                                <Input
                                    id="kode"
                                    value={kode}
                                    onChange={(e) => setKode(e.target.value)}
                                    placeholder="cth. GCG-20260714-0001"
                                    className="tabular-nums"
                                />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="hp">Nomor HP</Label>
                                <Input
                                    id="hp"
                                    inputMode="numeric"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="cth. 0812-3344-5566"
                                    className="tabular-nums"
                                />
                            </div>
                        </div>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-muted-foreground">
                                Coba contoh:{' '}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setKode('GCG-20260714-0001');
                                        setPhone('0812-3344-5566');
                                    }}
                                    className="font-medium text-primary tabular-nums hover:underline"
                                >
                                    GCG-20260714-0001
                                </button>
                            </p>
                            <Button type="submit" className="w-full sm:w-auto">
                                <Search />
                                Cek Status
                            </Button>
                        </div>
                    </form>

                    {prefilledFromQr && (
                        <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                            <p className="text-muted-foreground">
                                Kode{' '}
                                <span className="font-medium text-foreground tabular-nums">
                                    {query.kode}
                                </span>{' '}
                                sudah terisi dari QR nota. Masukkan nomor HP
                                Anda untuk melihat status.
                            </p>
                        </div>
                    )}

                    {result && <ResultCard tx={result} />}

                    {searched && !result && (
                        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
                            <PackageSearch className="size-8 text-muted-foreground" />
                            <p className="font-medium">
                                Transaksi tidak ditemukan
                            </p>
                            <p className="max-w-xs text-sm text-muted-foreground">
                                Periksa kembali kode transaksi Anda, atau
                                hubungi counter Gulam Cell II.
                            </p>
                        </div>
                    )}

                    <p className="mt-auto flex items-center justify-center gap-1.5 pt-6 text-xs text-muted-foreground">
                        <ShieldCheck className="size-3.5" />
                        Halaman resmi Gulam Cell II. Data gadai Anda bersifat
                        privat.
                    </p>
                </main>
            </div>
        </>
    );
}

function ResultCard({ tx }: { tx: Transaction }) {
    const total = tx.principal + tx.fee;
    const running = !STATUS_META[tx.status].terminal;
    const d = daysUntil(tx.dueDate);

    return (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-5 py-4">
                <div>
                    <p className="text-xs text-muted-foreground tabular-nums">
                        {tx.id}
                    </p>
                    <p className="font-semibold">{tx.device.name}</p>
                </div>
                <StatusBadge
                    status={tx.status}
                    withIcon={!running}
                    pulse={running}
                />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3">
                <Cell label="Dana Titipan" value={formatRupiah(tx.principal)} />
                <Cell
                    label={`Biaya (${tx.feePercent}%)`}
                    value={formatRupiah(tx.fee)}
                    className="border-l"
                />
                <Cell
                    label="Total Tebus"
                    value={formatRupiah(total)}
                    emphasize
                    className="col-span-2 border-t sm:col-span-1 sm:border-t-0 sm:border-l"
                />
            </div>

            <div className="border-t px-5 py-4">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Jatuh tempo</span>
                    <span className="text-right">
                        <span className="font-medium tabular-nums">
                            {formatDate(tx.dueDate)}
                        </span>
                        {running && (
                            <span
                                className={cn(
                                    'ml-2 text-xs',
                                    d <= 0
                                        ? 'text-overdue'
                                        : 'text-muted-foreground',
                                )}
                            >
                                {dueLabel(tx.dueDate)}
                            </span>
                        )}
                    </span>
                </div>
                {running && (
                    <p className="mt-3 rounded-lg bg-accent/60 p-3 text-xs text-muted-foreground">
                        Tebus sebelum jatuh tempo dengan membayar{' '}
                        <span className="font-medium text-foreground">
                            {formatRupiah(total)}
                        </span>{' '}
                        di counter. Butuh waktu lebih? Anda bisa memperpanjang.
                    </p>
                )}
            </div>
        </div>
    );
}

function Cell({
    label,
    value,
    emphasize,
    className,
}: {
    label: string;
    value: string;
    emphasize?: boolean;
    className?: string;
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
                )}
            >
                {value}
            </span>
        </div>
    );
}
