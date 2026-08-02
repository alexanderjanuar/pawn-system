import { ImagePlus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const NO_LABEL = '__none__';

/**
 * Multi-photo uploader where each photo can carry an optional label
 * (e.g. Depan, Belakang, IMEI). Labels are free to repeat across photos.
 * Files and labels are kept as parallel arrays so they POST as
 * `photos[]` + `photo_labels[]`.
 */
export function PhotoUploader({
    id,
    label,
    hint,
    suggestions,
    files,
    labels,
    onChange,
}: {
    id?: string;
    label: string;
    hint: string;
    suggestions: string[];
    files: File[];
    labels: string[];
    onChange: (files: File[], labels: string[]) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);

    const previews = useMemo(
        () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
        [files],
    );

    useEffect(
        () => () => previews.forEach((p) => URL.revokeObjectURL(p.url)),
        [previews],
    );

    const addFiles = (list: FileList | null) => {
        if (!list) {
            return;
        }

        const incoming = Array.from(list).filter((f) =>
            f.type.startsWith('image/'),
        );

        if (incoming.length === 0) {
            return;
        }

        onChange(
            [...files, ...incoming],
            [...labels, ...incoming.map(() => '')],
        );
    };

    const removeAt = (index: number) =>
        onChange(
            files.filter((_, i) => i !== index),
            labels.filter((_, i) => i !== index),
        );

    const setLabelAt = (index: number, value: string) =>
        onChange(
            files,
            labels.map((l, i) => (i === index ? value : l)),
        );

    const openPicker = () => inputRef.current?.click();

    return (
        <div className="grid gap-1.5">
            <Label>{label}</Label>

            <input
                ref={inputRef}
                id={id}
                type="file"
                accept="image/*"
                multiple
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
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {previews.map((p, index) => (
                                <div key={p.url} className="flex flex-col gap-1.5">
                                    <div className="group relative aspect-square overflow-hidden rounded-md border bg-muted">
                                        <img
                                            src={p.url}
                                            alt={p.file.name}
                                            className="size-full object-cover"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeAt(index)}
                                            aria-label={`Hapus ${p.file.name}`}
                                            className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-background/85 text-foreground shadow ring-1 ring-border transition hover:bg-background"
                                        >
                                            <X className="size-3" />
                                        </button>
                                    </div>
                                    <Select
                                        value={labels[index] || NO_LABEL}
                                        onValueChange={(v) =>
                                            setLabelAt(
                                                index,
                                                v === NO_LABEL ? '' : v,
                                            )
                                        }
                                    >
                                        <SelectTrigger
                                            size="sm"
                                            className="w-full"
                                            aria-label="Label foto"
                                        >
                                            <SelectValue placeholder="Label (opsional)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={NO_LABEL}>
                                                Tanpa label
                                            </SelectItem>
                                            {suggestions.map((s) => (
                                                <SelectItem key={s} value={s}>
                                                    {s}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={openPicker}
                                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                            >
                                <ImagePlus className="size-4" />
                                <span className="text-[10px]">Tambah</span>
                            </button>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{previews.length} foto dipilih</span>
                            <button
                                type="button"
                                onClick={() => onChange([], [])}
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
