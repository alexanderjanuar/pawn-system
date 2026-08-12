import { Info } from 'lucide-react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

/** Explains how "Pemasukan Biaya" (interest income) is calculated. */
export function IncomeInfo() {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label="Cara hitung pendapatan"
                    className="inline-flex text-muted-foreground/70 transition-colors hover:text-foreground"
                >
                    <Info className="size-3.5" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="w-80 text-sm normal-case tracking-normal"
            >
                <p className="font-semibold">Cara hitung pendapatan</p>
                <p className="mt-1 text-muted-foreground">
                    Total bunga (biaya titipan) yang benar-benar dibayar pada
                    periode ini, dihitung per tanggal bayar.
                </p>

                <ul className="mt-3 space-y-2">
                    <li className="flex gap-2">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                        <span>
                            <span className="font-medium">Perpanjang</span> —
                            bunga yang dibayar saat perpanjang.
                        </span>
                    </li>
                    <li className="flex gap-2">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                        <span>
                            <span className="font-medium">Tebus</span> —
                            bunganya saja (total tebus − dana titipan).
                        </span>
                    </li>
                </ul>

                <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                    Dana titipan (pokok) tidak dihitung karena itu modal yang
                    kembali. Bunga tiap periode dihitung sekali, jadi tanpa dobel
                    hitung.
                </p>
            </PopoverContent>
        </Popover>
    );
}
