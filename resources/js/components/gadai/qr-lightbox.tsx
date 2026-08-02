import { Copy, Download, Link2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { TransactionQr } from '@/components/gadai/transaction-qr';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

function slugify(label: string): string {
    return (
        label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'qr'
    );
}

/**
 * QR preview modal with Salin / Unduh actions. Displays a crisp SVG QR and
 * keeps a hidden high-resolution canvas that backs PNG export and clipboard
 * copy. The trigger is passed as children.
 */
export function QrLightbox({
    value,
    label,
    caption,
    children,
}: {
    value: string;
    label: string;
    caption?: string;
    children: ReactNode;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const pngBlob = (): Promise<Blob> =>
        new Promise((resolve, reject) => {
            const canvas = canvasRef.current;

            if (!canvas) {
                reject(new Error('no canvas'));

                return;
            }

            canvas.toBlob(
                (out) =>
                    out ? resolve(out) : reject(new Error('toBlob failed')),
                'image/png',
            );
        });

    const download = async () => {
        try {
            const blob = await pngBlob();
            const objectUrl = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = objectUrl;
            anchor.download = `qr-${slugify(label)}.png`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(objectUrl);
        } catch {
            toast.error('Gagal mengunduh QR.');
        }
    };

    const copyImage = async () => {
        try {
            const blob = await pngBlob();
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob }),
            ]);
            toast.success('QR disalin ke clipboard.');
        } catch {
            toast.error('Gagal menyalin QR.');
        }
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success('Tautan disalin.');
        } catch {
            toast.error('Gagal menyalin tautan.');
        }
    };

    return (
        <Dialog>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{label}</DialogTitle>
                    {caption && (
                        <DialogDescription>{caption}</DialogDescription>
                    )}
                </DialogHeader>

                <div className="flex flex-col items-center gap-4">
                    <div className="rounded-xl border bg-white p-5">
                        <TransactionQr value={value} size={288} />
                    </div>
                    <p className="w-full text-center text-xs break-all text-muted-foreground">
                        {value}
                    </p>
                    <div className="flex w-full flex-wrap justify-center gap-2">
                        <Button variant="outline" size="sm" onClick={copyImage}>
                            <Copy />
                            Salin QR
                        </Button>
                        <Button variant="outline" size="sm" onClick={copyLink}>
                            <Link2 />
                            Salin tautan
                        </Button>
                        <Button size="sm" onClick={download}>
                            <Download />
                            Unduh
                        </Button>
                    </div>
                </div>

                {/* Hidden high-res canvas backing PNG export and clipboard copy. */}
                <QRCodeCanvas
                    ref={canvasRef}
                    value={value}
                    size={1024}
                    level="Q"
                    marginSize={2}
                    bgColor="#ffffff"
                    fgColor="#0a0a0a"
                    className="hidden"
                />
            </DialogContent>
        </Dialog>
    );
}
