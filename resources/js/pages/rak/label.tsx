import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Rak = {
    name: string;
    capacity: number | null;
    storeName: string | null;
    count: number;
};

/**
 * Printable shelf label: a large rack name to stick on the physical rack, so
 * the shelf in front of the clerk and the name in the system always match.
 */
export default function RakLabel({ rak }: { rak: Rak }) {
    return (
        <>
            <Head title={`Label ${rak.name}`} />
            <div className="min-h-svh bg-muted/40 py-8 print:min-h-0 print:bg-white print:py-0">
                {/* Toolbar (hidden on print) */}
                <div className="no-print mx-auto mb-6 flex w-full max-w-[620px] items-center justify-between px-4">
                    <Button
                        asChild
                        variant="ghost"
                        className="text-muted-foreground"
                    >
                        <Link href="/rak">
                            <ArrowLeft />
                            Kembali ke rak
                        </Link>
                    </Button>
                    <Button onClick={() => window.print()}>
                        <Printer />
                        Cetak Label
                    </Button>
                </div>

                {/* Label sheet */}
                <div className="mx-auto flex w-full max-w-[620px] flex-col items-center justify-center gap-6 border-4 border-neutral-900 bg-white px-8 py-16 text-center text-neutral-900 shadow-sm print:shadow-none">
                    {rak.storeName && (
                        <p className="text-lg font-medium tracking-widest uppercase">
                            {rak.storeName}
                        </p>
                    )}

                    <p className="text-7xl leading-none font-black tracking-tight uppercase sm:text-8xl">
                        {rak.name}
                    </p>

                    <div className="flex items-center gap-6 border-t-2 border-neutral-900 pt-5 text-base">
                        <span>
                            Kapasitas{' '}
                            <span className="font-bold tabular-nums">
                                {rak.capacity ?? '—'}
                            </span>
                        </span>
                        <span className="text-neutral-400">·</span>
                        <span>
                            Terisi{' '}
                            <span className="font-bold tabular-nums">
                                {rak.count}
                            </span>
                        </span>
                    </div>

                    <p className="max-w-sm text-xs text-neutral-500">
                        Setiap HP yang masuk atau keluar rak ini wajib dicatat
                        di sistem agar isi fisik dan sistem selalu cocok.
                    </p>
                </div>
            </div>
        </>
    );
}
