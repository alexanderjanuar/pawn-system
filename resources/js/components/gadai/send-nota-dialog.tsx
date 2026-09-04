import { useForm, usePage } from '@inertiajs/react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatPhone } from '@/lib/format';
import { buildNotaMessage } from '@/lib/nota-message';
import type { Transaction } from '@/types/gadai';

/**
 * Sends the customer a short link to their nota over WhatsApp. This dialog
 * previews/edits the message; the link is appended server-side.
 */
export function SendNotaDialog({
    tx,
    open,
    onOpenChange,
}: {
    tx: Transaction;
    open: boolean;
    onOpenChange: (value: boolean) => void;
}) {
    const props = usePage().props;
    const shopName =
        props.activeStoreName && props.activeStoreName !== 'Semua Toko'
            ? props.activeStoreName
            : 'Gulam Cell';
    const { data, setData, post, processing, reset } = useForm({
        message: buildNotaMessage(tx, shopName),
    });
    const noPhone = !tx.customer.phone;

    const submit = () =>
        post(`/transaksi/${tx.id}/kirim-nota`, {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        });

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                onOpenChange(next);

                if (!next) {
                    reset();
                }
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Kirim Nota ke WhatsApp</DialogTitle>
                    <DialogDescription>
                        {noPhone ? (
                            'Pelanggan ini belum punya nomor WhatsApp.'
                        ) : (
                            <>
                                Link nota dikirim ke {tx.customer.name} ·{' '}
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
                        dahulu sebelum mengirim nota.
                    </p>
                ) : (
                    <div className="grid gap-1.5">
                        <Label htmlFor="nota-message">
                            Pesan (bisa diedit)
                        </Label>
                        <Textarea
                            id="nota-message"
                            value={data.message}
                            onChange={(e) => setData('message', e.target.value)}
                            className="min-h-56 text-sm leading-relaxed"
                        />
                        <p className="text-xs text-muted-foreground">
                            Link nota otomatis disertakan di pesan. Pelanggan
                            membuka lalu bisa menyimpan atau mencetak notanya.
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
                        <FileText />
                        Kirim Nota
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
