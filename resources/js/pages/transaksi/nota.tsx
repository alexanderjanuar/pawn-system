import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Printer } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { parsePattern } from '@/components/gadai/pattern-lock';
import { TransactionQr } from '@/components/gadai/transaction-qr';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatDate, formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/types/gadai';

const KETENTUAN = [
    'Segera perpanjang jika sampai dengan tanggal keluar / jatuh tempo tetapi barang anda belum ditebus, karena segala hal yang terjadi atas barang setelah tanggal tersebut adalah diluar tanggung jawab kami (kecuali ada perjanjian tertentu).',
    'Pembayaran titipan barang / perpanjang / cicilan dana, bisa via transfer Bank jika berhalangan datang ke Counter.',
    'Mohon nota jangan sampai hilang dan harus dibawa saat penebusan barang / perpanjangan.',
    'Harus segera konfirmasi / beritahukan kepada kami jika anda mengganti nomor handphone.',
    'Barang yang dimasukkan tidak boleh memiliki masalah kepemilikan / masalah hukum / bukan kreditan.',
    'Kami tidak bertanggung jawab atas segala tuntutan dari pihak manapun, jika ternyata barang bermasalah kepemilikan / hukum karena pemalsuan data, persyaratan atau kebohongan yang dilakukan oleh pelanggan saat memasukkan barangnya.',
    'Kami berhak menuntut pengambilan dana kepada pelanggan (Perihal: Poin No. 5 dan No. 6) karena hal-hal yang diluar kuasa dan sepengetahuan kami.',
    'Pelanggan dan Gulam Cell II sepakat atas ketentuan dan perjanjian dengan tanpa paksaan dari pihak manapun.',
];

type Mode = 'portrait' | 'landscape';

export default function Nota({ transaction }: { transaction: Transaction }) {
    const tx = transaction;
    const [mode, setMode] = useState<Mode>('portrait');
    const landscape = mode === 'landscape';

    return (
        <>
            <Head title={`Nota ${tx.id}`} />
            {landscape && (
                <style media="print">{`@page{size:A4 landscape;margin:8mm}`}</style>
            )}
            <div className="min-h-svh bg-muted/40 py-8 print:min-h-0 print:bg-white print:py-0">
                {/* Toolbar (hidden on print) */}
                <div className="no-print mx-auto mb-6 flex w-full max-w-[900px] flex-wrap items-center justify-between gap-3 px-4">
                    <Button
                        asChild
                        variant="ghost"
                        className="text-muted-foreground"
                    >
                        <Link href={`/transaksi/${tx.id}`}>
                            <ArrowLeft />
                            Kembali ke transaksi
                        </Link>
                    </Button>
                    <div className="flex flex-wrap items-center gap-2">
                        <ToggleGroup
                            type="single"
                            variant="outline"
                            value={mode}
                            onValueChange={(v) => v && setMode(v as Mode)}
                        >
                            <ToggleGroupItem value="portrait" className="px-3">
                                Potret · 1 nota
                            </ToggleGroupItem>
                            <ToggleGroupItem value="landscape" className="px-3">
                                Lanskap · 2 nota
                            </ToggleGroupItem>
                        </ToggleGroup>
                        <Button onClick={() => window.print()}>
                            <Printer />
                            Cetak Nota
                        </Button>
                    </div>
                </div>

                {landscape ? (
                    <div className="print-sheet mx-auto flex w-full max-w-[1100px] items-stretch bg-white text-neutral-900 shadow-sm print:max-w-none print:shadow-none">
                        <div className="min-w-0 flex-1 p-4 print:p-2">
                            <NotaSheet tx={tx} half />
                        </div>
                        {/* Garis potong */}
                        <div className="relative mx-1 border-l-2 border-dashed border-neutral-500 print:mx-0.5">
                            <span className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 bg-white px-0.5 text-[11px] leading-none text-neutral-500">
                                ✂
                            </span>
                            <span className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 bg-white px-0.5 text-[11px] leading-none text-neutral-500">
                                ✂
                            </span>
                        </div>
                        <div className="min-w-0 flex-1 p-4 print:p-2">
                            <NotaSheet tx={tx} half />
                        </div>
                    </div>
                ) : (
                    <div className="print-sheet mx-auto w-full max-w-[760px] bg-white p-6 text-neutral-900 shadow-sm sm:p-8 print:max-w-none print:p-0 print:shadow-none">
                        <NotaSheet tx={tx} />
                    </div>
                )}
            </div>
        </>
    );
}

function NotaSheet({ tx, half = false }: { tx: Transaction; half?: boolean }) {
    return (
        <>
            {/* Header */}
            <div
                className={cn(
                    'text-center',
                    half ? 'border-2 px-2 py-1' : 'border-[3px] px-4 py-2.5',
                    'border-neutral-900',
                )}
            >
                <h1
                    className={cn(
                        'leading-none font-extrabold tracking-tight',
                        half ? 'text-lg' : 'text-2xl sm:text-3xl',
                    )}
                >
                    GULAM CELL II
                </h1>
                <p
                    className={cn(
                        'font-medium',
                        half
                            ? 'mt-0.5 text-[8px]'
                            : 'mt-1 text-[11px] sm:text-sm',
                    )}
                >
                    Jl. Serayu Tanah Merah No. 57 / Hp : 0852 2387 7117
                </p>
            </div>

            {/* No nota + title + QR */}
            <div
                className={cn(
                    'flex items-stretch',
                    half ? 'mt-2 gap-1.5' : 'mt-3 gap-2.5',
                )}
            >
                <div
                    className={cn(
                        'flex flex-1 flex-col',
                        half ? 'gap-1.5' : 'gap-2.5',
                    )}
                >
                    <div
                        className={cn(
                            'flex items-center gap-2 border-neutral-900 font-bold',
                            half
                                ? 'border px-2 py-1 text-[10px]'
                                : 'border-2 px-3 py-2 text-sm',
                        )}
                    >
                        NO NOTA.
                        <span className="tabular-nums">{tx.id}</span>
                    </div>
                    <div
                        className={cn(
                            'flex flex-1 items-center justify-center border-neutral-900 text-center font-bold tracking-wide',
                            half
                                ? 'border px-2 text-[10px]'
                                : 'border-2 px-3 text-sm',
                        )}
                    >
                        NOTA BARANG GADAI
                    </div>
                </div>
                <div
                    className={cn(
                        'flex shrink-0 flex-col items-center justify-center gap-0.5 border-neutral-900',
                        half ? 'border px-1 py-1' : 'border-2 px-1.5 py-1.5',
                    )}
                >
                    <TransactionQr value={tx.statusUrl} size={half ? 48 : 64} />
                    <span
                        className={cn(
                            'font-bold tracking-wide text-neutral-700 uppercase',
                            half ? 'text-[6px]' : 'text-[8px]',
                        )}
                    >
                        Scan Cek Status
                    </span>
                </div>
            </div>

            {/* Pelanggan */}
            <FieldBox half={half}>
                <Row
                    half={half}
                    label="Tanggal Masuk"
                    value={formatDate(tx.notaStartDate)}
                />
                <Row
                    half={half}
                    label="Nama Pelanggan"
                    value={tx.customer.name}
                />
                <Row
                    half={half}
                    label="No. HP Pelanggan"
                    value={tx.customer.phone}
                />
                <Row half={half} label="Nama Pemilik" value={tx.deviceOwner} />
                <Row half={half} label="Alamat" value={tx.customer.address} />
            </FieldBox>

            {/* Barang */}
            <FieldBox half={half}>
                <Row
                    half={half}
                    label="Nama & Tipe Barang"
                    value={tx.device.name}
                />
                <Row
                    half={half}
                    label="Kelengkapan"
                    value={tx.device.kelengkapan}
                />
                {tx.device.type === 'motor' ? (
                    <>
                        <Row
                            half={half}
                            label="Plat Nomor"
                            value={tx.device.platNomor || '-'}
                        />
                        <Row
                            half={half}
                            label="No. Rangka"
                            value={tx.device.noRangka || '-'}
                        />
                    </>
                ) : (
                    <Row
                        half={half}
                        label="Nomor Seri"
                        value={tx.device.serial}
                    />
                )}
            </FieldBox>

            {/* Dana */}
            <FieldBox half={half}>
                <Row
                    half={half}
                    label="Dana Titipan"
                    value={formatRupiah(tx.principal)}
                />
                <Row
                    half={half}
                    label="Biaya Penitipan Barang"
                    value={formatRupiah(tx.fee)}
                />
                <Row
                    half={half}
                    label="Tanggal Keluar"
                    value={formatDate(tx.dueDate)}
                />
            </FieldBox>

            {/* Kunci barang & catatan (hanya jika ada) */}
            {(hasLock(tx) || Boolean(tx.notes?.trim())) && (
                <FieldBox half={half}>
                    {hasLock(tx) && <LockRow half={half} device={tx.device} />}
                    {Boolean(tx.notes?.trim()) && (
                        <Row half={half} label="Catatan" value={tx.notes} />
                    )}
                </FieldBox>
            )}

            {/* Ketentuan */}
            <ol
                className={cn(
                    'list-decimal',
                    half
                        ? 'mt-2 space-y-0.5 pl-3.5 text-[6.5px] leading-[1.2]'
                        : 'mt-4 space-y-1 pl-5 text-[10.5px] leading-snug sm:text-[11px] print:mt-3 print:space-y-0.5',
                )}
            >
                {KETENTUAN.map((item, i) => (
                    <li key={i}>{item}</li>
                ))}
            </ol>

            {/* Tanda tangan */}
            <div
                className={cn(
                    'grid grid-cols-2',
                    half
                        ? 'mt-3 gap-3 text-[9px]'
                        : 'mt-6 gap-8 text-sm print:mt-4',
                )}
            >
                <div>
                    <p className="font-medium">Pelanggan</p>
                    <div
                        className={cn(
                            'border-b border-neutral-900 text-neutral-600',
                            half
                                ? 'mt-8 w-full pt-0.5 text-[8px]'
                                : 'mt-14 w-44 pt-1 text-xs print:mt-10',
                        )}
                    >
                        {tx.customer.name}
                    </div>
                </div>
                <div>
                    <p className="font-medium">Petugas,</p>
                    <div
                        className={cn(
                            'border-b border-neutral-900 text-neutral-600',
                            half
                                ? 'mt-8 w-full pt-0.5 text-[8px]'
                                : 'mt-14 w-44 pt-1 text-xs print:mt-10',
                        )}
                    >
                        {tx.clerk}
                    </div>
                </div>
            </div>
        </>
    );
}

/** Whether the device has an unlock code worth printing. */
function hasLock(tx: Transaction): boolean {
    return tx.device.lockType !== 'none' && Boolean(tx.device.lockValue);
}

const LOCK_SUFFIX: Record<string, string> = {
    pin: 'PIN',
    password: 'Kata Sandi',
    pattern: 'Pola',
};

/** A nota row for the device unlock code: PIN/password as text, pattern as a grid. */
function LockRow({
    device,
    half,
}: {
    device: Transaction['device'];
    half: boolean;
}) {
    const label = `Kunci Barang · ${LOCK_SUFFIX[device.lockType] ?? ''}`.trim();
    const value = device.lockValue ?? '';

    if (device.lockType === 'pattern') {
        const seq = parsePattern(value);

        return (
            <Row
                half={half}
                label={label}
                value={
                    <span className="flex items-center gap-2">
                        <NotaPattern value={value} size={half ? 44 : 72} />
                        <span
                            className={cn(
                                'font-bold tabular-nums',
                                half ? 'text-[9px]' : 'text-sm',
                            )}
                        >
                            {seq.join(' → ')}
                        </span>
                    </span>
                }
            />
        );
    }

    return (
        <Row
            half={half}
            label={label}
            value={<span className="font-mono font-bold">{value}</span>}
        />
    );
}

const PATTERN_DOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Center of dot `n` (1-9) on a 120x120 grid. */
function patternCenter(n: number): { cx: number; cy: number } {
    const i = n - 1;

    return { cx: 20 + (i % 3) * 40, cy: 20 + Math.floor(i / 3) * 40 };
}

/** Print-friendly (neutral, ink-only) render of an unlock pattern. */
function NotaPattern({ value, size }: { value: string; size: number }) {
    const seq = parsePattern(value);
    const order = new Map<number, number>();
    seq.forEach((n, i) => order.set(n, i + 1));

    return (
        <svg
            viewBox="0 0 120 120"
            width={size}
            height={size}
            className="shrink-0 rounded border border-neutral-400"
        >
            {seq.slice(1).map((n, i) => {
                const a = patternCenter(seq[i]);
                const b = patternCenter(n);

                return (
                    <line
                        key={`${seq[i]}-${n}`}
                        x1={a.cx}
                        y1={a.cy}
                        x2={b.cx}
                        y2={b.cy}
                        className="stroke-neutral-900"
                        strokeWidth={3}
                        strokeLinecap="round"
                    />
                );
            })}
            {PATTERN_DOTS.map((n) => {
                const { cx, cy } = patternCenter(n);
                const active = order.has(n);

                return (
                    <g key={n}>
                        <circle
                            cx={cx}
                            cy={cy}
                            r={active ? 11 : 5}
                            className={
                                active ? 'fill-neutral-900' : 'fill-neutral-400'
                            }
                        />
                        {active && (
                            <text
                                x={cx}
                                y={cy}
                                textAnchor="middle"
                                dominantBaseline="central"
                                className="fill-neutral-50"
                                fontSize={10}
                                fontWeight={700}
                            >
                                {order.get(n)}
                            </text>
                        )}
                    </g>
                );
            })}
        </svg>
    );
}

function FieldBox({ children, half }: { children: ReactNode; half: boolean }) {
    return (
        <div
            className={cn(
                'border-neutral-900',
                half ? 'mt-2 border' : 'mt-3 border-2',
            )}
        >
            {children}
        </div>
    );
}

function Row({
    label,
    value,
    half,
}: {
    label: string;
    value: ReactNode;
    half: boolean;
}) {
    return (
        <div
            className={cn(
                'flex items-baseline border-neutral-900 last:border-b-0',
                half
                    ? 'gap-1.5 border-b px-2 py-1'
                    : 'gap-2 border-b-2 px-3 py-2',
            )}
        >
            <span
                className={cn(
                    'shrink-0 font-bold uppercase',
                    half
                        ? 'w-24 text-[8px]'
                        : 'w-36 text-[11px] sm:w-56 sm:text-sm',
                )}
            >
                {label}
            </span>
            <span className="font-bold">:</span>
            <span
                className={cn(
                    'min-w-0 flex-1 break-words',
                    half ? 'text-[9px]' : 'text-sm',
                )}
            >
                {value}
            </span>
        </div>
    );
}
