import { useForm, usePage } from '@inertiajs/react';
import { Wallet } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { DatePicker } from '@/components/gadai/date-picker';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatRupiah } from '@/lib/format';
import type { NextDue } from '@/lib/reminder';

/** The piutang fields the payment form needs. */
export type PayablePiutang = {
    id: number;
    code: string;
    debtorName: string;
    remaining: number;
    nextDue: NextDue | null;
};

/**
 * Wraps a trigger (`children`) with a dialog that records one instalment
 * payment, so a cashier can settle a row straight from the piutang list.
 * Offers one-tap amounts for the next instalment and for paying it off.
 */
export function PiutangPaymentDialog({
    piutang,
    children,
}: {
    piutang: PayablePiutang;
    children: ReactNode;
}) {
    const today = usePage().props.serverDate;
    const [open, setOpen] = useState(false);
    const form = useForm({
        amount: piutang.nextDue?.amount ?? piutang.remaining,
        paid_at: today,
        note: '',
    });

    const shortcuts: { label: string; amount: number }[] = [];

    if (piutang.nextDue && piutang.nextDue.amount < piutang.remaining) {
        shortcuts.push({
            label: `Cicilan ke-${piutang.nextDue.seq}`,
            amount: piutang.nextDue.amount,
        });
    }

    shortcuts.push({ label: 'Lunasi', amount: piutang.remaining });

    const submit = () =>
        form.post(`/piutang/${piutang.id}/bayar`, {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                form.reset();
            },
        });

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);

                if (!next) {
                    form.reset();
                    form.clearErrors();
                }
            }}
        >
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                    <DialogTitle>Bayar Angsuran</DialogTitle>
                    <DialogDescription>
                        {piutang.debtorName} · {piutang.code} · sisa{' '}
                        <span className="font-medium tabular-nums">
                            {formatRupiah(piutang.remaining)}
                        </span>
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    <div className="grid gap-1.5">
                        <Label htmlFor="bayar-jumlah">Jumlah bayar</Label>
                        <div className="relative">
                            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                                Rp
                            </span>
                            <Input
                                id="bayar-jumlah"
                                inputMode="numeric"
                                value={
                                    form.data.amount
                                        ? form.data.amount.toLocaleString(
                                              'id-ID',
                                          )
                                        : ''
                                }
                                onChange={(e) =>
                                    form.setData(
                                        'amount',
                                        parseInt(
                                            e.target.value.replace(/\D/g, ''),
                                            10,
                                        ) || 0,
                                    )
                                }
                                placeholder="0"
                                className="pl-9 tabular-nums"
                                autoFocus
                            />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {shortcuts.map((s) => (
                                <button
                                    key={s.label}
                                    type="button"
                                    onClick={() =>
                                        form.setData('amount', s.amount)
                                    }
                                    className="rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                >
                                    {s.label} · {formatRupiah(s.amount)}
                                </button>
                            ))}
                        </div>
                        {form.errors.amount && (
                            <p className="text-xs text-destructive">
                                {form.errors.amount}
                            </p>
                        )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="bayar-tanggal">Tanggal bayar</Label>
                            <DatePicker
                                id="bayar-tanggal"
                                value={form.data.paid_at}
                                onChange={(v) => form.setData('paid_at', v)}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="bayar-catatan">
                                Catatan (opsional)
                            </Label>
                            <Input
                                id="bayar-catatan"
                                value={form.data.note}
                                onChange={(e) =>
                                    form.setData('note', e.target.value)
                                }
                                placeholder="cth. transfer BCA"
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Batal</Button>
                    </DialogClose>
                    <Button
                        onClick={submit}
                        disabled={
                            form.processing ||
                            form.data.amount <= 0 ||
                            form.data.amount > piutang.remaining
                        }
                    >
                        <Wallet />
                        Simpan Pembayaran
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
