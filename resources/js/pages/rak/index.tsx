import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    ArrowRightLeft,
    Boxes,
    ChevronRight,
    MoreVertical,
    Plus,
    Save,
    Search,
    Smartphone,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/gadai/page-header';
import { StatusBadge } from '@/components/status-badge';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { GadaiStatus } from '@/types/gadai';

type RakItem = {
    id: string;
    device: string;
    customer: string;
    status: GadaiStatus;
    detailUrl: string;
};

type Rak = {
    id: number;
    name: string;
    capacity: number | null;
    active: boolean;
    storeName: string | null;
    count: number;
    items: RakItem[];
};

type PageProps = { racks: Rak[]; canManage: boolean };

/** fullness → tone tokens (green → amber → red). */
function toneOf(rak: Rak): 'ok' | 'high' | 'full' | 'open' {
    if (rak.capacity == null) {
        return 'open';
    }

    const ratio = rak.capacity > 0 ? rak.count / rak.capacity : 0;

    return ratio >= 1 ? 'full' : ratio >= 0.8 ? 'high' : 'ok';
}

const FILL: Record<string, string> = {
    ok: 'bg-aktif',
    high: 'bg-perpanjang',
    full: 'bg-lelang',
    open: 'bg-primary',
};

const BAR_TRACK: Record<string, string> = {
    ok: 'bg-aktif/15',
    high: 'bg-perpanjang/15',
    full: 'bg-lelang/15',
    open: 'bg-primary/15',
};

export default function RakIndex({ racks, canManage }: PageProps) {
    const showStore = usePage().props.activeStore === 'all';
    const [query, setQuery] = useState('');
    // Store just the id so the open modal re-derives fresh data after a move.
    const [itemsRakId, setItemsRakId] = useState<number | null>(null);
    const [editTarget, setEditTarget] = useState<Rak | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Rak | null>(null);

    const itemsTarget =
        itemsRakId != null
            ? (racks.find((r) => r.id === itemsRakId) ?? null)
            : null;

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();

        return q
            ? racks.filter((r) => r.name.toLowerCase().includes(q))
            : racks;
    }, [racks, query]);

    const totals = useMemo(
        () => ({
            racks: racks.length,
            held: racks.reduce((s, r) => s + r.count, 0),
            full: racks.filter(
                (r) => r.capacity != null && r.count >= r.capacity,
            ).length,
        }),
        [racks],
    );

    const toggleActive = (r: Rak) =>
        router.put(
            `/rak/${r.id}`,
            { active: !r.active },
            { preserveScroll: true },
        );

    return (
        <>
            <Head title="Rak" />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <PageHeader
                    title="Rak"
                    description="Rak fisik tempat HP gadai disimpan. Klik 'Lihat HP tersimpan' untuk membuka daftar isinya."
                >
                    {canManage && <TambahRakDialog />}
                </PageHeader>

                {racks.length > 0 && (
                    <div className="grid w-full grid-cols-3 overflow-hidden rounded-xl border bg-card shadow-sm sm:w-fit">
                        <Kpi label="Jumlah Rak" value={String(totals.racks)} />
                        <Kpi
                            label="HP Tersimpan"
                            value={String(totals.held)}
                            className="border-l"
                        />
                        <Kpi
                            label="Rak Penuh"
                            value={String(totals.full)}
                            className="border-l"
                            tone={totals.full > 0 ? 'text-lelang' : undefined}
                        />
                    </div>
                )}

                {racks.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card p-12 text-center">
                        <Boxes className="size-8 text-muted-foreground" />
                        <p className="font-medium">Belum ada rak</p>
                        <p className="max-w-sm text-sm text-muted-foreground">
                            {canManage
                                ? 'Tambahkan rak agar HP gadai bisa ditempatkan dan mudah dicari.'
                                : 'Rak akan muncul di sini setelah Pemilik menambahkannya.'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="relative w-full sm:max-w-xs">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Cari rak…"
                                className="pl-9"
                            />
                        </div>

                        <div className="grid items-start gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))]">
                            {filtered.map((rak) => (
                                <RakCard
                                    key={rak.id}
                                    rak={rak}
                                    showStore={showStore}
                                    canManage={canManage}
                                    onOpenItems={() => setItemsRakId(rak.id)}
                                    onEdit={() => setEditTarget(rak)}
                                    onToggleActive={() => toggleActive(rak)}
                                    onDelete={() => setDeleteTarget(rak)}
                                />
                            ))}
                        </div>

                        {filtered.length === 0 && (
                            <p className="py-8 text-center text-sm text-muted-foreground">
                                Tidak ada rak cocok dengan "{query}".
                            </p>
                        )}
                    </>
                )}
            </div>

            {itemsTarget && (
                <RakItemsDialog
                    rak={itemsTarget}
                    racks={racks}
                    showStore={showStore}
                    onClose={() => setItemsRakId(null)}
                />
            )}
            {editTarget && (
                <EditRakDialog
                    rak={editTarget}
                    onClose={() => setEditTarget(null)}
                />
            )}
            {deleteTarget && (
                <HapusRakDialog
                    rak={deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                />
            )}
        </>
    );
}

function RakCard({
    rak,
    showStore,
    canManage,
    onOpenItems,
    onEdit,
    onToggleActive,
    onDelete,
}: {
    rak: Rak;
    showStore: boolean;
    canManage: boolean;
    onOpenItems: () => void;
    onEdit: () => void;
    onToggleActive: () => void;
    onDelete: () => void;
}) {
    const tone = toneOf(rak);
    const ratio =
        rak.capacity && rak.capacity > 0
            ? Math.min(1, rak.count / rak.capacity)
            : rak.count > 0
                ? 1
                : 0;

    return (
        <div
            className={cn(
                'group flex flex-col rounded-xl border bg-card shadow-sm transition-all hover:shadow-md',
                !rak.active && 'opacity-60',
                tone === 'full' && rak.active && 'border-lelang/40',
            )}
        >
            <div className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <Boxes
                                className={cn(
                                    'size-4 shrink-0',
                                    tone === 'full'
                                        ? 'text-lelang'
                                        : 'text-muted-foreground',
                                )}
                            />
                            <h3 className="truncate font-semibold">
                                {rak.name}
                            </h3>
                            {!rak.active && (
                                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                    Nonaktif
                                </span>
                            )}
                        </div>
                        {showStore && rak.storeName && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {rak.storeName}
                            </p>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <span
                            className={cn(
                                'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                                tone === 'full'
                                    ? 'bg-lelang-soft text-lelang'
                                    : 'bg-secondary text-foreground/80',
                            )}
                        >
                            {rak.count}
                            {rak.capacity != null ? `/${rak.capacity}` : ''}
                        </span>
                        {canManage && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7"
                                    >
                                        <MoreVertical className="size-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={onEdit}>
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={onToggleActive}>
                                        {rak.active
                                            ? 'Nonaktifkan'
                                            : 'Aktifkan'}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        variant="destructive"
                                        onSelect={onDelete}
                                    >
                                        Hapus
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>

                {/* Shelf visualization */}
                <Slots rak={rak} tone={tone} />

                {/* Capacity bar */}
                <div
                    className={cn(
                        'h-1.5 overflow-hidden rounded-full',
                        BAR_TRACK[tone],
                    )}
                >
                    <div
                        className={cn(
                            'h-full rounded-full transition-all',
                            FILL[tone],
                        )}
                        style={{ width: `${Math.round(ratio * 100)}%` }}
                    />
                </div>

                {rak.count > 0 ? (
                    <button
                        type="button"
                        onClick={onOpenItems}
                        className="-mx-1 flex items-center justify-between rounded-md px-1 py-0.5 text-sm text-foreground transition-colors hover:text-primary"
                    >
                        <span>Lihat {rak.count} HP tersimpan</span>
                        <ChevronRight className="size-4" />
                    </button>
                ) : (
                    <span className="text-sm text-muted-foreground">Kosong</span>
                )}
            </div>
        </div>
    );
}

/** Modal listing the phones stored on a rack, with a move-to-rack action. */
function RakItemsDialog({
    rak,
    racks,
    showStore,
    onClose,
}: {
    rak: Rak;
    racks: Rak[];
    showStore: boolean;
    onClose: () => void;
}) {
    const [q, setQ] = useState('');

    const items = useMemo(() => {
        const s = q.trim().toLowerCase();

        return s
            ? rak.items.filter((i) =>
                  `${i.device} ${i.id} ${i.customer}`.toLowerCase().includes(s),
              )
            : rak.items;
    }, [rak.items, q]);

    // Other active racks in the same store are valid move destinations.
    const targets = useMemo(
        () =>
            racks.filter(
                (r) =>
                    r.id !== rak.id &&
                    r.active &&
                    r.storeName === rak.storeName,
            ),
        [racks, rak.id, rak.storeName],
    );

    const move = (item: RakItem, rakId: number | null) =>
        router.put(
            `/rak/pindah/${item.id}`,
            { rak_id: rakId },
            { preserveScroll: true },
        );

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Boxes className="size-5 text-primary" />
                        <span className="truncate">{rak.name}</span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-foreground/80 tabular-nums">
                            {rak.count}
                            {rak.capacity != null ? `/${rak.capacity}` : ''}
                        </span>
                    </DialogTitle>
                    <DialogDescription>
                        {rak.count} HP tersimpan
                        {showStore && rak.storeName
                            ? ` · ${rak.storeName}`
                            : ''}{' '}
                        · gunakan ikon{' '}
                        <ArrowRightLeft className="inline size-3" /> untuk pindah
                        rak
                    </DialogDescription>
                </DialogHeader>

                {rak.items.length > 6 && (
                    <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Cari HP, kode, atau pelanggan…"
                            className="pl-9"
                        />
                    </div>
                )}

                <ul className="-mx-6 max-h-[55vh] divide-y overflow-y-auto border-y">
                    {items.length > 0 ? (
                        items.map((item) => (
                            <li
                                key={item.id}
                                className="flex items-center gap-2 px-6 py-2.5 transition-colors hover:bg-accent"
                            >
                                <Link
                                    href={item.detailUrl}
                                    className="flex min-w-0 flex-1 items-center gap-3"
                                >
                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/70">
                                        <Smartphone className="size-4.5" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-medium">
                                            {item.device}
                                        </div>
                                        <div className="truncate text-xs text-muted-foreground tabular-nums">
                                            {item.id} · {item.customer}
                                        </div>
                                    </div>
                                </Link>
                                <StatusBadge status={item.status} size="sm" />
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-7 shrink-0 text-muted-foreground hover:text-primary"
                                            title="Pindah rak"
                                        >
                                            <ArrowRightLeft className="size-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        className="w-56"
                                    >
                                        <DropdownMenuLabel>
                                            Pindahkan ke…
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {targets.length > 0 ? (
                                            targets.map((t) => (
                                                <DropdownMenuItem
                                                    key={t.id}
                                                    onSelect={() =>
                                                        move(item, t.id)
                                                    }
                                                >
                                                    <Boxes className="text-muted-foreground" />
                                                    <span className="truncate">
                                                        {t.name}
                                                    </span>
                                                    {t.capacity != null && (
                                                        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                                                            {t.count}/
                                                            {t.capacity}
                                                        </span>
                                                    )}
                                                </DropdownMenuItem>
                                            ))
                                        ) : (
                                            <DropdownMenuItem disabled>
                                                Tidak ada rak lain
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            onSelect={() => move(item, null)}
                                        >
                                            Keluarkan dari rak
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </li>
                        ))
                    ) : (
                        <li className="px-6 py-10 text-center text-sm text-muted-foreground">
                            {rak.count === 0
                                ? 'Rak ini sudah kosong.'
                                : `Tidak ada HP cocok dengan "${q}".`}
                        </li>
                    )}
                </ul>
            </DialogContent>
        </Dialog>
    );
}

function Slots({ rak, tone }: { rak: Rak; tone: string }) {
    const MAX = 28;
    const cap = rak.capacity;
    const count = rak.count;
    const cells = cap != null ? cap : count;

    // Too many to draw as slots — the bar above already conveys fullness.
    if (cells > MAX || (cap == null && count === 0)) {
        return (
            <div className="flex min-h-6 items-center text-xs text-muted-foreground">
                {cap == null
                    ? count === 0
                        ? 'Rak kosong · tanpa batas'
                        : 'Tanpa batas kapasitas'
                    : `${count} dari ${cap} terisi`}
            </div>
        );
    }

    return (
        <div className="flex min-h-6 flex-wrap gap-1">
            {Array.from({ length: cells }).map((_, i) => (
                <span
                    key={i}
                    className={cn(
                        'size-5 rounded-sm transition-colors',
                        i < count
                            ? FILL[tone]
                            : 'border border-dashed border-muted-foreground/30 bg-muted/30',
                    )}
                />
            ))}
        </div>
    );
}

function Kpi({
    label,
    value,
    className,
    tone,
}: {
    label: string;
    value: string;
    className?: string;
    tone?: string;
}) {
    return (
        <div className={cn('flex min-w-0 flex-col gap-1 p-4 sm:p-5', className)}>
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </span>
            <span
                className={cn('text-xl font-semibold tabular-nums', tone)}
            >
                {value}
            </span>
        </div>
    );
}

function RakFields({
    form,
}: {
    form: ReturnType<typeof useForm<{ name: string; capacity: string }>>;
}) {
    return (
        <div className="grid gap-4">
            <div className="grid gap-1.5">
                <Label htmlFor="rak-nama">Nama rak</Label>
                <Input
                    id="rak-nama"
                    value={form.data.name}
                    onChange={(e) => form.setData('name', e.target.value)}
                    placeholder="cth. Rak A"
                    autoFocus
                />
                {form.errors.name && (
                    <p className="text-xs text-destructive">
                        {form.errors.name}
                    </p>
                )}
            </div>
            <div className="grid gap-1.5">
                <Label htmlFor="rak-kapasitas">Kapasitas (opsional)</Label>
                <Input
                    id="rak-kapasitas"
                    type="number"
                    min={1}
                    value={form.data.capacity}
                    onChange={(e) => form.setData('capacity', e.target.value)}
                    placeholder="cth. 12"
                    className="no-spinner tabular-nums"
                />
                {form.errors.capacity ? (
                    <p className="text-xs text-destructive">
                        {form.errors.capacity}
                    </p>
                ) : (
                    <p className="text-xs text-muted-foreground">
                        Kosongkan bila tanpa batas.
                    </p>
                )}
            </div>
        </div>
    );
}

function TambahRakDialog() {
    const [open, setOpen] = useState(false);
    const form = useForm({ name: '', capacity: '' });

    const submit = () =>
        form.post('/rak', {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                form.reset();
            },
        });

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                setOpen(o);

                if (!o) {
                    form.reset();
                    form.clearErrors();
                }
            }}
        >
            <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                    <Plus />
                    Tambah Rak
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Tambah Rak</DialogTitle>
                    <DialogDescription>
                        Rak fisik untuk menyimpan HP gadai di toko ini.
                    </DialogDescription>
                </DialogHeader>
                <RakFields form={form} />
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Batal</Button>
                    </DialogClose>
                    <Button
                        onClick={submit}
                        disabled={form.processing || !form.data.name.trim()}
                    >
                        <Plus />
                        Tambah
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function EditRakDialog({ rak, onClose }: { rak: Rak; onClose: () => void }) {
    const form = useForm({
        name: rak.name,
        capacity: rak.capacity != null ? String(rak.capacity) : '',
    });

    const submit = () =>
        form.put(`/rak/${rak.id}`, {
            preserveScroll: true,
            onSuccess: onClose,
        });

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Rak</DialogTitle>
                    <DialogDescription>
                        Ubah nama atau kapasitas rak.
                    </DialogDescription>
                </DialogHeader>
                <RakFields form={form} />
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Batal
                    </Button>
                    <Button
                        onClick={submit}
                        disabled={form.processing || !form.data.name.trim()}
                    >
                        <Save />
                        Simpan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function HapusRakDialog({ rak, onClose }: { rak: Rak; onClose: () => void }) {
    const [processing, setProcessing] = useState(false);
    const blocked = rak.count > 0;

    const confirm = () => {
        setProcessing(true);
        router.delete(`/rak/${rak.id}`, {
            preserveScroll: true,
            onSuccess: onClose,
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Hapus Rak</DialogTitle>
                    <DialogDescription>
                        {blocked
                            ? `Rak ${rak.name} masih menyimpan ${rak.count} HP. Pindahkan dulu sebelum menghapus.`
                            : `Hapus rak ${rak.name}? Tindakan ini tidak dapat dibatalkan.`}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Batal
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={confirm}
                        disabled={processing || blocked}
                    >
                        Hapus
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

RakIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Rak', href: '/rak' },
    ],
};
