import { Plus, Split, Wallet as WalletIcon, X } from 'lucide-react';
import { defaultWalletId, useWallets } from '@/components/gadai/wallet-field';
import type { WalletOption } from '@/components/gadai/wallet-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';

export type SplitRow = { wallet_id: number | null; amount: number };

/** Sum of every row except the last (which auto-fills the remainder). */
function editableSum(split: SplitRow[]): number {
    return split.slice(0, -1).reduce((total, r) => total + (r.amount || 0), 0);
}

/** Whether the current funding choice is complete and can be submitted. */
export function isFundingValid(
    split: SplitRow[] | null,
    principal: number,
): boolean {
    if (split === null) {
        return true;
    }

    if (split.length < 2 || split.some((r) => !r.wallet_id)) {
        return false;
    }

    const remainder = principal - editableSum(split);

    return (
        remainder >= 0 && split.slice(0, -1).every((r) => (r.amount || 0) >= 1)
    );
}

/** Normalise a split for submission: the last pocket takes the remainder. */
export function normalizeFunding(
    split: SplitRow[] | null,
    principal: number,
): SplitRow[] | null {
    if (!split || split.length < 2) {
        return null;
    }

    const editable = split.slice(0, -1);
    const last = {
        ...split[split.length - 1],
        amount: Math.max(0, principal - editableSum(split)),
    };

    return [...editable, last];
}

/**
 * Funding-source picker for a disbursement. One pocket by default, or split
 * across several (e.g. 90% from Toko, the rest from Kak Gulam). The last pocket
 * always holds the remainder, so the total always matches the principal.
 */
export function WalletSourceField({
    walletId,
    onWalletIdChange,
    split,
    onSplitChange,
    principal,
    label = 'Dompet sumber dana',
    hint,
}: {
    walletId: number | null;
    onWalletIdChange: (value: number) => void;
    split: SplitRow[] | null;
    onSplitChange: (value: SplitRow[] | null) => void;
    principal: number;
    label?: string;
    hint?: string;
}) {
    const wallets = useWallets();

    if (wallets.length <= 1) {
        return null;
    }

    const isSplit = split !== null;
    const rows = split ?? [];
    const remainder = principal - editableSum(rows);
    const lastIndex = rows.length - 1;

    const walletName = (id: number | null) =>
        wallets.find((w) => w.id === id)?.name ?? 'Dompet';

    const enableSplit = () => {
        const first = walletId ?? defaultWalletId(wallets);
        const second = wallets.find((w) => w.id !== first)?.id ?? first;
        onSplitChange([
            { wallet_id: first, amount: principal },
            { wallet_id: second, amount: 0 },
        ]);
    };

    const setRow = (index: number, patch: Partial<SplitRow>) =>
        onSplitChange(
            rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
        );

    const addRow = () => {
        const used = new Set(rows.map((r) => r.wallet_id));
        const next = wallets.find((w) => !used.has(w.id))?.id ?? wallets[0].id;
        // Insert before the remainder row so it stays last.
        onSplitChange([
            ...rows.slice(0, -1),
            { wallet_id: next, amount: 0 },
            rows[lastIndex],
        ]);
    };

    const removeRow = (index: number) => {
        const next = rows.filter((_, i) => i !== index);
        onSplitChange(next.length >= 2 ? next : null);
    };

    return (
        <div className="grid gap-2">
            <Label>{label}</Label>

            {/* Mode: satu dompet vs dibagi ke beberapa dompet */}
            <ToggleGroup
                type="single"
                variant="outline"
                value={isSplit ? 'split' : 'single'}
                onValueChange={(v) => {
                    if (!v) {
                        return;
                    }

                    if (v === 'split') {
                        enableSplit();
                    } else {
                        onSplitChange(null);
                    }
                }}
                className="w-full"
            >
                <ToggleGroupItem value="single" className="flex-1 gap-1.5">
                    <WalletIcon className="size-4" />1 Dompet
                </ToggleGroupItem>
                <ToggleGroupItem value="split" className="flex-1 gap-1.5">
                    <Split className="size-4" />
                    Bagi Beberapa
                </ToggleGroupItem>
            </ToggleGroup>

            {!isSplit ? (
                <SingleSelect
                    wallets={wallets}
                    value={walletId}
                    onChange={onWalletIdChange}
                />
            ) : (
                <div className="grid gap-2.5 rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">
                        Isi jumlah tiap dompet. Baris terakhir otomatis jadi{' '}
                        <span className="font-medium">sisa</span> agar totalnya
                        pas dengan dana titipan.
                    </p>
                    {rows.map((row, i) => {
                        const isLast = i === lastIndex;
                        const amount = isLast
                            ? Math.max(0, remainder)
                            : row.amount;
                        const pct =
                            principal > 0
                                ? Math.round((amount / principal) * 100)
                                : 0;

                        return (
                            <div key={i} className="flex items-center gap-2">
                                <Select
                                    value={
                                        row.wallet_id
                                            ? String(row.wallet_id)
                                            : undefined
                                    }
                                    onValueChange={(v) =>
                                        setRow(i, { wallet_id: Number(v) })
                                    }
                                >
                                    <SelectTrigger className="h-9 w-[38%] min-w-0">
                                        <SelectValue placeholder="Dompet" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {wallets.map((w) => (
                                            <SelectItem
                                                key={w.id}
                                                value={String(w.id)}
                                            >
                                                {w.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="relative flex-1">
                                    <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                                        Rp
                                    </span>
                                    <Input
                                        inputMode="numeric"
                                        readOnly={isLast}
                                        value={
                                            amount
                                                ? amount.toLocaleString('id-ID')
                                                : isLast
                                                  ? '0'
                                                  : ''
                                        }
                                        onChange={(e) =>
                                            setRow(i, {
                                                amount:
                                                    parseInt(
                                                        e.target.value.replace(
                                                            /\D/g,
                                                            '',
                                                        ),
                                                        10,
                                                    ) || 0,
                                            })
                                        }
                                        placeholder="0"
                                        title={
                                            isLast ? 'Sisa otomatis' : undefined
                                        }
                                        className={cn(
                                            'h-9 pl-7 tabular-nums',
                                            isLast &&
                                                'bg-muted/50 text-muted-foreground',
                                        )}
                                    />
                                </div>
                                <span className="w-9 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                                    {pct}%
                                </span>
                                {isLast ? (
                                    <span
                                        className="flex size-8 shrink-0 items-center justify-center text-[10px] font-medium text-muted-foreground"
                                        title="Sisa otomatis"
                                    >
                                        sisa
                                    </span>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 shrink-0"
                                        onClick={() => removeRow(i)}
                                        title="Hapus baris"
                                    >
                                        <X className="size-4" />
                                    </Button>
                                )}
                            </div>
                        );
                    })}

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addRow}
                            disabled={rows.length >= wallets.length}
                        >
                            <Plus />
                            Tambah dompet
                        </Button>
                        <span
                            className={cn(
                                'text-xs tabular-nums',
                                remainder < 0
                                    ? 'font-medium text-overdue'
                                    : 'text-muted-foreground',
                            )}
                        >
                            {remainder < 0
                                ? `Kelebihan ${formatRupiah(-remainder)} — kurangi`
                                : `Sisa ${formatRupiah(Math.max(0, remainder))} → ${walletName(rows[lastIndex]?.wallet_id)}`}
                        </span>
                    </div>
                </div>
            )}

            {hint && !isSplit && (
                <p className="text-xs text-muted-foreground">{hint}</p>
            )}
        </div>
    );
}

/** Plain single-pocket dropdown (shared shape with WalletField). */
function SingleSelect({
    wallets,
    value,
    onChange,
}: {
    wallets: WalletOption[];
    value: number | null;
    onChange: (value: number) => void;
}) {
    return (
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
    );
}
