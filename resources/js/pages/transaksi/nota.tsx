import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Printer } from 'lucide-react';
import type { ReactNode } from 'react';
import { TransactionQr } from '@/components/gadai/transaction-qr';
import { Button } from '@/components/ui/button';
import { formatDate, formatRupiah } from '@/lib/format';
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

export default function Nota({ transaction }: { transaction: Transaction }) {
    const tx = transaction;

    return (
        <>
            <Head title={`Nota ${tx.id}`} />
            <div className="min-h-svh bg-muted/40 py-8 print:bg-white print:py-0">
                {/* Toolbar (hidden on print) */}
                <div className="no-print mx-auto mb-6 flex w-full max-w-[760px] items-center justify-between px-4">
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
                    <Button onClick={() => window.print()}>
                        <Printer />
                        Cetak Nota
                    </Button>
                </div>

                {/* Nota sheet */}
                <div className="print-sheet mx-auto w-full max-w-[760px] bg-white p-6 text-neutral-900 shadow-sm sm:p-8 print:max-w-none print:p-0 print:shadow-none">
                    {/* Header */}
                    <div className="border-[3px] border-neutral-900 px-4 py-2.5 text-center">
                        <h1 className="text-2xl leading-none font-extrabold tracking-tight sm:text-3xl">
                            GULAM CELL II
                        </h1>
                        <p className="mt-1 text-[11px] font-medium sm:text-sm">
                            Jl. Serayu Tanah Merah No. 57 / Hp : 0852 2387 7117
                        </p>
                    </div>

                    {/* No nota + title + QR */}
                    <div className="mt-3 flex items-stretch gap-2.5">
                        <div className="flex flex-1 flex-col gap-2.5">
                            <div className="flex items-center gap-2 border-2 border-neutral-900 px-3 py-2 text-sm font-bold">
                                NO NOTA.
                                <span className="tabular-nums">{tx.id}</span>
                            </div>
                            <div className="flex flex-1 items-center justify-center border-2 border-neutral-900 px-3 text-center text-sm font-bold tracking-wide">
                                NOTA BARANG GADAI
                            </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 border-2 border-neutral-900 px-1.5 py-1.5">
                            <TransactionQr value={tx.statusUrl} size={64} />
                            <span className="text-[8px] font-bold tracking-wide text-neutral-700 uppercase">
                                Scan Cek Status
                            </span>
                        </div>
                    </div>

                    {/* Pelanggan */}
                    <FieldBox>
                        <Row
                            label="Tanggal Masuk"
                            value={formatDate(tx.startDate)}
                        />
                        <Row label="Nama Pelanggan" value={tx.customer.name} />
                        <Row
                            label="No. HP Pelanggan"
                            value={tx.customer.phone}
                        />
                        <Row label="Nama Pemilik" value={tx.deviceOwner} />
                        <Row label="Alamat" value={tx.customer.address} />
                    </FieldBox>

                    {/* Barang */}
                    <FieldBox>
                        <Row
                            label="Nama & Tipe Barang"
                            value={tx.device.name}
                        />
                        <Row
                            label="Kelengkapan"
                            value={tx.device.kelengkapan}
                        />
                        <Row label="Nomor Seri" value={tx.device.serial} />
                    </FieldBox>

                    {/* Dana */}
                    <FieldBox>
                        <Row
                            label="Dana Titipan"
                            value={formatRupiah(tx.principal)}
                        />
                        <Row
                            label="Biaya Penitipan Barang"
                            value={formatRupiah(tx.fee)}
                        />
                        <Row
                            label="Tanggal Keluar"
                            value={formatDate(tx.dueDate)}
                        />
                    </FieldBox>

                    {/* Ketentuan */}
                    <ol className="mt-4 list-decimal space-y-1 pl-5 text-[10.5px] leading-snug sm:text-[11px]">
                        {KETENTUAN.map((item, i) => (
                            <li key={i}>{item}</li>
                        ))}
                    </ol>

                    {/* Tanda tangan */}
                    <div className="mt-6 grid grid-cols-2 gap-8 text-sm">
                        <div>
                            <p className="font-medium">Pelanggan</p>
                            <div className="mt-14 w-44 border-b border-neutral-900 pt-1 text-xs text-neutral-600">
                                {tx.customer.name}
                            </div>
                        </div>
                        <div>
                            <p className="font-medium">Petugas,</p>
                            <div className="mt-14 w-44 border-b border-neutral-900 pt-1 text-xs text-neutral-600">
                                {tx.clerk}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

function FieldBox({ children }: { children: ReactNode }) {
    return <div className="mt-3 border-2 border-neutral-900">{children}</div>;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="flex items-baseline gap-2 border-b-2 border-neutral-900 px-3 py-2 last:border-b-0">
            <span className="w-36 shrink-0 text-[11px] font-bold uppercase sm:w-56 sm:text-sm">
                {label}
            </span>
            <span className="font-bold">:</span>
            <span className="min-w-0 flex-1 text-sm break-words">{value}</span>
        </div>
    );
}
