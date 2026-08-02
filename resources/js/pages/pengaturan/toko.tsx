import { Head, router, useForm } from '@inertiajs/react';
import { MoreVertical, Plus, Save, Store as StoreIcon } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/gadai/page-header';
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
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Toko = {
    id: number;
    code: string;
    notaPrefix: string;
    name: string;
    address: string | null;
    phone: string | null;
    active: boolean;
    transactionCount: number;
    clerkCount: number;
};

type PageProps = { stores: Toko[]; suggestedCode: string };

export default function KelolaToko({ stores, suggestedCode }: PageProps) {
    const [editTarget, setEditTarget] = useState<Toko | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Toko | null>(null);

    const toggleActive = (t: Toko) =>
        router.put(
            `/pengaturan/toko/${t.id}`,
            {
                name: t.name,
                code: t.code,
                nota_prefix: t.notaPrefix,
                address: t.address,
                phone: t.phone,
                active: !t.active,
            },
            { preserveScroll: true },
        );

    const rowActions = (t: Toko) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0">
                    <MoreVertical />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditTarget(t)}>
                    Edit
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => toggleActive(t)}>
                    {t.active ? 'Nonaktifkan' : 'Aktifkan'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeleteTarget(t)}
                >
                    Hapus
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    return (
        <>
            <Head title="Kelola Toko" />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <PageHeader
                    title="Kelola Toko"
                    description="Cabang toko. Setiap transaksi, petugas, dan akun petugas terkait ke satu toko. Hanya Pemilik yang dapat mengelola."
                >
                    <TambahTokoDialog suggestedCode={suggestedCode} />
                </PageHeader>

                {/* Mobile: cards */}
                <div className="flex flex-col gap-3 sm:hidden">
                    {stores.map((t) => (
                        <div
                            key={t.id}
                            className={cn(
                                'rounded-xl border bg-card p-4 shadow-sm',
                                !t.active && 'bg-muted/20',
                            )}
                        >
                            <div className="flex items-start gap-3">
                                <div className="min-w-0 flex-1">
                                    <div
                                        className={cn(
                                            'truncate font-medium',
                                            !t.active && 'text-muted-foreground',
                                        )}
                                    >
                                        {t.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground tabular-nums">
                                        {t.code} · nota {t.notaPrefix}
                                    </div>
                                </div>
                                <StatusPill active={t.active} />
                                {rowActions(t)}
                            </div>
                            <div className="mt-3 text-xs text-muted-foreground tabular-nums">
                                {t.transactionCount} transaksi · {t.clerkCount}{' '}
                                petugas
                            </div>
                        </div>
                    ))}
                </div>

                {/* Desktop: table */}
                <section className="hidden overflow-hidden rounded-xl border bg-card shadow-sm sm:block">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[48rem] text-sm">
                            <thead>
                                <tr className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
                                    <th className="px-5 py-3 font-medium">
                                        Toko
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Nota
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Transaksi
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Petugas
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Status
                                    </th>
                                    <th className="px-5 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {stores.map((t) => (
                                    <tr
                                        key={t.id}
                                        className={cn(!t.active && 'bg-muted/20')}
                                    >
                                        <td className="px-5 py-3">
                                            <div
                                                className={cn(
                                                    'font-medium',
                                                    !t.active &&
                                                        'text-muted-foreground',
                                                )}
                                            >
                                                {t.name}
                                            </div>
                                            <div className="text-xs text-muted-foreground tabular-nums">
                                                {t.code}
                                                {t.address ? ` · ${t.address}` : ''}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 tabular-nums">
                                            {t.notaPrefix}
                                        </td>
                                        <td className="px-5 py-3 text-muted-foreground tabular-nums">
                                            {t.transactionCount}
                                        </td>
                                        <td className="px-5 py-3 text-muted-foreground tabular-nums">
                                            {t.clerkCount}
                                        </td>
                                        <td className="px-5 py-3">
                                            <StatusPill active={t.active} />
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            {rowActions(t)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            {editTarget && (
                <EditTokoDialog
                    toko={editTarget}
                    onClose={() => setEditTarget(null)}
                />
            )}
            {deleteTarget && (
                <HapusTokoDialog
                    toko={deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                />
            )}
        </>
    );
}

function StatusPill({ active }: { active: boolean }) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                active
                    ? 'bg-aktif-soft text-aktif'
                    : 'bg-muted text-muted-foreground',
            )}
        >
            <span
                className={cn(
                    'size-1.5 rounded-full',
                    active ? 'bg-aktif' : 'bg-muted-foreground/50',
                )}
                aria-hidden
            />
            {active ? 'Aktif' : 'Nonaktif'}
        </span>
    );
}

type TokoFields = {
    name: string;
    code: string;
    nota_prefix: string;
    address: string;
    phone: string;
};

function TokoFieldset({
    form,
}: {
    form: ReturnType<typeof useForm<TokoFields>>;
}) {
    return (
        <div className="grid gap-4">
            <div className="grid gap-1.5">
                <Label htmlFor="toko-nama">Nama toko</Label>
                <Input
                    id="toko-nama"
                    value={form.data.name}
                    onChange={(e) => form.setData('name', e.target.value)}
                    placeholder="cth. Gulam Cell III"
                    autoFocus
                />
                {form.errors.name && (
                    <p className="text-xs text-destructive">
                        {form.errors.name}
                    </p>
                )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                    <Label htmlFor="toko-code">Kode toko</Label>
                    <Input
                        id="toko-code"
                        value={form.data.code}
                        onChange={(e) => form.setData('code', e.target.value)}
                        placeholder="TK-002"
                        className="tabular-nums"
                    />
                    {form.errors.code && (
                        <p className="text-xs text-destructive">
                            {form.errors.code}
                        </p>
                    )}
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="toko-prefix">Prefix nota</Label>
                    <Input
                        id="toko-prefix"
                        value={form.data.nota_prefix}
                        onChange={(e) =>
                            form.setData(
                                'nota_prefix',
                                e.target.value.toUpperCase(),
                            )
                        }
                        placeholder="cth. GCC"
                        className="tabular-nums"
                    />
                    {form.errors.nota_prefix ? (
                        <p className="text-xs text-destructive">
                            {form.errors.nota_prefix}
                        </p>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            Awalan nomor nota, mis. {form.data.nota_prefix ||
                                'GCC'}
                            -20260802-0001
                        </p>
                    )}
                </div>
            </div>
            <div className="grid gap-1.5">
                <Label htmlFor="toko-alamat">Alamat</Label>
                <Input
                    id="toko-alamat"
                    value={form.data.address}
                    onChange={(e) => form.setData('address', e.target.value)}
                    placeholder="Jl. …"
                />
            </div>
            <div className="grid gap-1.5">
                <Label htmlFor="toko-hp">Telepon</Label>
                <Input
                    id="toko-hp"
                    value={form.data.phone}
                    onChange={(e) => form.setData('phone', e.target.value)}
                    placeholder="cth. 0812-0000-0000"
                    className="tabular-nums"
                />
            </div>
        </div>
    );
}

function TambahTokoDialog({ suggestedCode }: { suggestedCode: string }) {
    const [open, setOpen] = useState(false);
    const form = useForm<TokoFields>({
        name: '',
        code: suggestedCode,
        nota_prefix: '',
        address: '',
        phone: '',
    });

    const submit = () =>
        form.post('/pengaturan/toko', {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                form.reset();
                form.setData('code', suggestedCode);
            },
        });

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                setOpen(o);

                if (!o) {
                    form.reset();
                    form.setData('code', suggestedCode);
                    form.clearErrors();
                }
            }}
        >
            <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                    <StoreIcon />
                    Tambah Toko
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Tambah Toko</DialogTitle>
                    <DialogDescription>
                        Cabang baru. Transaksi dan petugas akan ditautkan ke
                        toko ini.
                    </DialogDescription>
                </DialogHeader>
                <TokoFieldset form={form} />
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Batal</Button>
                    </DialogClose>
                    <Button onClick={submit} disabled={form.processing}>
                        <Plus />
                        Tambah
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function EditTokoDialog({
    toko,
    onClose,
}: {
    toko: Toko;
    onClose: () => void;
}) {
    const form = useForm<TokoFields>({
        name: toko.name,
        code: toko.code,
        nota_prefix: toko.notaPrefix,
        address: toko.address ?? '',
        phone: toko.phone ?? '',
    });

    const submit = () =>
        form.put(`/pengaturan/toko/${toko.id}`, {
            preserveScroll: true,
            onSuccess: onClose,
        });

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Toko</DialogTitle>
                    <DialogDescription>
                        Ubah detail cabang.
                    </DialogDescription>
                </DialogHeader>
                <TokoFieldset form={form} />
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Batal
                    </Button>
                    <Button onClick={submit} disabled={form.processing}>
                        <Save />
                        Simpan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function HapusTokoDialog({
    toko,
    onClose,
}: {
    toko: Toko;
    onClose: () => void;
}) {
    const [processing, setProcessing] = useState(false);
    const blocked = toko.transactionCount > 0 || toko.clerkCount > 0;

    const confirm = () => {
        setProcessing(true);
        router.delete(`/pengaturan/toko/${toko.id}`, {
            preserveScroll: true,
            onSuccess: onClose,
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Hapus Toko</DialogTitle>
                    <DialogDescription>
                        {blocked
                            ? `Toko ${toko.name} masih punya ${toko.transactionCount} transaksi dan ${toko.clerkCount} petugas. Nonaktifkan saja daripada menghapus.`
                            : `Hapus toko ${toko.name}? Tindakan ini tidak dapat dibatalkan.`}
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

KelolaToko.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Kelola Toko', href: '/pengaturan/toko' },
    ],
};
