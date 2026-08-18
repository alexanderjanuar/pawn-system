import { usePage } from '@inertiajs/react';
import { Wallet as WalletIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export type WalletOption = { id: number; name: string; isDefault: boolean };

/** Active cash pockets shared on every page (see HandleInertiaRequests). */
export function useWallets(): WalletOption[] {
    return (usePage().props.wallets as WalletOption[] | undefined) ?? [];
}

/** The pocket money defaults to (the shop's own), or the first one. */
export function defaultWalletId(wallets: WalletOption[]): number | null {
    return wallets.find((w) => w.isDefault)?.id ?? wallets[0]?.id ?? null;
}

/**
 * Picker for which cash pocket (dompet) a movement belongs to. Renders nothing
 * when there is only one pocket, since there is no choice to make.
 */
export function WalletField({
    value,
    onChange,
    label = 'Dompet',
    hint,
}: {
    value: number | null;
    onChange: (value: number) => void;
    label?: string;
    hint?: string;
}) {
    const wallets = useWallets();

    if (wallets.length <= 1) {
        return null;
    }

    return (
        <div className="grid gap-1.5">
            <Label>{label}</Label>
            <Select
                value={value ? String(value) : undefined}
                onValueChange={(v) => onChange(Number(v))}
            >
                <SelectTrigger>
                    <SelectValue placeholder="Pilih dompet" />
                </SelectTrigger>
                <SelectContent>
                    {wallets.map((w) => (
                        <SelectItem key={w.id} value={String(w.id)}>
                            <span className="flex items-center gap-1.5">
                                <WalletIcon className="size-3.5 text-muted-foreground" />
                                {w.name}
                            </span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}
