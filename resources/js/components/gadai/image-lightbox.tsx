import { Copy, Download, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

/** Extension from an image URL (ignores query string), defaulting to jpg. */
function extensionOf(url: string): string {
    const path = url.split('?')[0];
    const dot = path.lastIndexOf('.');

    return dot >= 0 ? path.slice(dot + 1).toLowerCase() : 'jpg';
}

function slugify(label: string): string {
    return (
        label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'gambar'
    );
}

/** Clipboard only reliably accepts PNG; convert other types via canvas. */
async function toPng(blob: Blob): Promise<Blob> {
    if (blob.type === 'image/png') {
        return blob;
    }

    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
        return blob;
    }

    ctx.drawImage(bitmap, 0, 0);

    return await new Promise((resolve, reject) => {
        canvas.toBlob(
            (out) => (out ? resolve(out) : reject(new Error('toBlob failed'))),
            'image/png',
        );
    });
}

/**
 * Near-fullscreen image preview with Buka / Salin / Unduh actions. The trigger
 * is passed as children (e.g. a thumbnail button).
 */
export function ImageLightbox({
    url,
    label,
    children,
}: {
    url: string;
    label: string;
    children: ReactNode;
}) {
    const download = async () => {
        try {
            const blob = await (await fetch(url)).blob();
            const objectUrl = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = objectUrl;
            anchor.download = `${slugify(label)}.${extensionOf(url)}`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(objectUrl);
        } catch {
            window.open(url, '_blank', 'noopener');
            toast.error('Tidak bisa mengunduh otomatis.', {
                description:
                    'Gambar dibuka di tab baru, simpan manual dari sana.',
            });
        }
    };

    const copy = async () => {
        try {
            const blob = await (await fetch(url)).blob();
            const png = await toPng(blob);
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': png }),
            ]);
            toast.success('Gambar disalin ke clipboard.');
        } catch {
            try {
                await navigator.clipboard.writeText(url);
                toast.success('Tautan gambar disalin.');
            } catch {
                toast.error('Gagal menyalin gambar.');
            }
        }
    };

    return (
        <Dialog>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="flex h-[94vh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[96vw]">
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3 pr-12">
                    <DialogTitle className="truncate text-sm">
                        {label}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Pratinjau gambar {label}. Bisa dibuka di tab baru,
                        disalin, atau diunduh.
                    </DialogDescription>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                            <a href={url} target="_blank" rel="noreferrer">
                                <ExternalLink />
                                <span className="hidden sm:inline">Buka</span>
                            </a>
                        </Button>
                        <Button variant="outline" size="sm" onClick={copy}>
                            <Copy />
                            <span className="hidden sm:inline">Salin</span>
                        </Button>
                        <Button size="sm" onClick={download}>
                            <Download />
                            <span className="hidden sm:inline">Unduh</span>
                        </Button>
                    </div>
                </div>
                <div className="flex flex-1 items-center justify-center overflow-auto bg-neutral-950/90 p-4">
                    <img
                        src={url}
                        alt={label}
                        className="max-h-full max-w-full object-contain"
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
