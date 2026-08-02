import { ImagePlus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Functional image upload: click or drag-and-drop, multiple or single,
 * with live previews and per-item removal. Files are held in React state
 * (the backend build will POST them); previews use object URLs.
 */
export function FileDropzone({
    id,
    label,
    hint,
    multiple = false,
    accept = 'image/*',
    value,
    onChange,
}: {
    id?: string;
    label: string;
    hint: string;
    multiple?: boolean;
    accept?: string;
    value: File[];
    onChange: (files: File[]) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);

    const previews = useMemo(
        () => value.map((file) => ({ file, url: URL.createObjectURL(file) })),
        [value],
    );

    useEffect(
        () => () => previews.forEach((p) => URL.revokeObjectURL(p.url)),
        [previews],
    );

    const addFiles = (files: FileList | null) => {
        if (!files) {
            return;
        }

        const incoming = Array.from(files).filter((f) =>
            f.type.startsWith('image/'),
        );

        if (incoming.length === 0) {
            return;
        }

        onChange(multiple ? [...value, ...incoming] : incoming.slice(0, 1));
    };

    const openPicker = () => inputRef.current?.click();

    return (
        <div className="grid gap-1.5">
            <Label>{label}</Label>

            <input
                ref={inputRef}
                id={id}
                type="file"
                accept={accept}
                multiple={multiple}
                className="sr-only"
                onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = '';
                }}
            />

            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    addFiles(e.dataTransfer.files);
                }}
                className={cn(
                    'rounded-lg border border-dashed transition-colors',
                    dragOver
                        ? 'border-primary bg-accent/60'
                        : 'bg-muted/30 hover:border-primary/60',
                )}
            >
                {previews.length === 0 ? (
                    <button
                        type="button"
                        onClick={openPicker}
                        className="flex w-full flex-col items-center justify-center gap-1.5 px-4 py-6 text-center"
                    >
                        <ImagePlus className="size-5 text-muted-foreground" />
                        <span className="text-sm font-medium">
                            Seret ke sini atau klik
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {hint}
                        </span>
                    </button>
                ) : (
                    <div className="p-3">
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                            {previews.map((p, index) => (
                                <div
                                    key={p.url}
                                    className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
                                >
                                    <img
                                        src={p.url}
                                        alt={p.file.name}
                                        className="size-full object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onChange(
                                                value.filter(
                                                    (_, i) => i !== index,
                                                ),
                                            )
                                        }
                                        aria-label={`Hapus ${p.file.name}`}
                                        className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-background/85 text-foreground shadow ring-1 ring-border transition hover:bg-background"
                                    >
                                        <X className="size-3" />
                                    </button>
                                </div>
                            ))}
                            {multiple && (
                                <button
                                    type="button"
                                    onClick={openPicker}
                                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                                >
                                    <ImagePlus className="size-4" />
                                    <span className="text-[10px]">Tambah</span>
                                </button>
                            )}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{previews.length} file dipilih</span>
                            <button
                                type="button"
                                onClick={() => onChange([])}
                                className="font-medium hover:text-foreground"
                            >
                                Hapus semua
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
