import { useForm, usePage } from '@inertiajs/react';
import { Send } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatPhone } from '@/lib/format';
import { buildReminderMessage } from '@/lib/reminder';
import type { Transaction } from '@/types/gadai';

/**
 * Wraps a trigger (`children`) with a dialog that previews the WhatsApp reminder
 * for one transaction, lets the clerk edit it, then sends it via Fonnte.
 */
export function ReminderDialog({
    tx,
    children,
}: {
    tx: Transaction;
    children: ReactNode;
}) {
    const props = usePage().props;
    // Use the specific store's name when one is selected; otherwise (the "Semua
    // Toko" overview, or single-shop) default to the shop name for the message.
    const shopName =
        props.activeStoreName && props.activeStoreName !== 'Semua Toko'
            ? props.activeStoreName
            : 'Gulam Cell';
    const [open, setOpen] = useState(false);
    const { data, setData, post, processing, reset } = useForm({
        message: buildReminderMessage(tx, shopName),
    });
    const noPhone = !tx.customer.phone;

    const submit = () =>
        post(`/transaksi/${tx.id}/ingatkan`, {
            preserveScroll: true,
            onSuccess: () => setOpen(false),
        });

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);

                if (!next) {
                    reset();
                }
            }}
        >
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Kirim Pengingat WhatsApp</DialogTitle>
                    <DialogDescription>
                        {noPhone ? (
                            'Pelanggan ini belum punya nomor WhatsApp.'
                        ) : (
                            <>
                                Dikirim ke {tx.customer.name} ·{' '}
                                <span className="tabular-nums">
                                    {formatPhone(tx.customer.phone)}
                                </span>
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>

                {noPhone ? (
                    <p className="rounded-lg border border-overdue/30 bg-overdue-soft/40 p-3 text-sm text-muted-foreground">
                        Tambahkan nomor telepon di data pelanggan terlebih
                        dahulu sebelum mengirim pengingat.
                    </p>
                ) : (
                    <div className="grid gap-1.5">
                        <Label htmlFor="reminder-message">
                            Pesan (bisa diedit)
                        </Label>
                        <Textarea
                            id="reminder-message"
                            value={data.message}
                            onChange={(e) => setData('message', e.target.value)}
                            className="min-h-64 text-sm leading-relaxed"
                        />
                        <p className="text-xs text-muted-foreground">
                            Bungkus dengan *bintang* agar tampil tebal di
                            WhatsApp.
                        </p>
                    </div>
                )}

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Batal</Button>
                    </DialogClose>
                    <Button
                        onClick={submit}
                        disabled={processing || noPhone || !data.message.trim()}
                    >
                        <Send />
                        Kirim WhatsApp
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
