import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { MoreVertical, Plus, UserCog, UserPlus, Users } from 'lucide-react';
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
import { cn, initials } from '@/lib/utils';

type Petugas = {
    id: number;
    name: string;
    active: boolean;
    storeName: string | null;
    transactionCount: number;
};

export default function KelolaPetugas({ petugas }: { petugas: Petugas[] }) {
    const [renameTarget, setRenameTarget] = useState<Petugas | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Petugas | null>(null);
    // Show which store each petugas belongs to only in the "all stores" view.
    const showStore = usePage().props.activeStore === 'all';

    const toggleActive = (p: Petugas) =>
        router.put(
            `/pengaturan/petugas/${p.id}`,
            { active: !p.active },
            { preserveScroll: true },
        );

    const rowActions = (p: Petugas) => (
        <RowActions
            petugas={p}
            onView={() => router.visit(`/pengaturan/petugas/${p.id}`)}
            onActivity={() =>
                router.visit(`/aktivitas?actor=${encodeURIComponent(p.name)}`)
            }
            onToggle={() => toggleActive(p)}
            onRename={() => setRenameTarget(p)}
            onDelete={() => setDeleteTarget(p)}
        />
    );

    return (
        <>
            <Head title="Kelola Petugas" />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <PageHeader
                    title="Kelola Petugas"
                    description="Daftar petugas yang menangani transaksi. Hanya yang aktif muncul saat mencatat gadai. Hanya Pemilik yang dapat mengelola."
                >
                    <TambahPetugasDialog />
                </PageHeader>

                {petugas.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card p-12 text-center">
                        <Users className="size-8 text-muted-foreground" />
                        <p className="font-medium">Belum ada petugas</p>
                        <p className="max-w-sm text-sm text-muted-foreground">
                            Tambahkan petugas agar bisa dipilih saat mencatat
                            transaksi gadai.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Mobile: cards */}
                        <div className="flex flex-col gap-3 sm:hidden">
                            {petugas.map((p) => (
                                <div
                                    key={p.id}
                                    className={cn(
                                        'rounded-xl border bg-card p-4 shadow-sm',
                                        !p.active && 'bg-muted/20',
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <PetugasAvatar
                                            name={p.name}
                                            active={p.active}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <Link
                                                href={`/pengaturan/petugas/${p.id}`}
                                                className={cn(
                                                    'block truncate font-medium hover:text-primary hover:underline',
                                                    !p.active &&
                                                        'text-muted-foreground',
                                                )}
                                            >
                                                {p.name}
                                            </Link>
                                            <div className="text-xs text-muted-foreground tabular-nums">
                                                {p.transactionCount} transaksi
                                                {showStore && p.storeName
                                                    ? ` · ${p.storeName}`
                                                    : ''}
                                            </div>
                                        </div>
                                        <StatusPill active={p.active} />
                                        {rowActions(p)}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop: table */}
                        <section className="hidden overflow-hidden rounded-xl border bg-card shadow-sm sm:block">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[36rem] text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
                                            <th className="px-5 py-3 font-medium">
                                                Nama
                                            </th>
                                            <th className="px-5 py-3 font-medium">
                                                Status
                                            </th>
                                            <th className="px-5 py-3 font-medium">
                                                Transaksi
                                            </th>
                                            <th className="px-5 py-3" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {petugas.map((p) => (
                                            <tr
                                                key={p.id}
                                                className={cn(
                                                    !p.active && 'bg-muted/20',
                                                )}
                                            >
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <PetugasAvatar
                                                            name={p.name}
                                                            active={p.active}
                                                        />
                                                        <div className="min-w-0">
                                                            <Link
                                                                href={`/pengaturan/petugas/${p.id}`}
                                                                className={cn(
                                                                    'font-medium hover:text-primary hover:underline',
                                                                    !p.active &&
                                                                        'text-muted-foreground',
                                                                )}
                                                            >
                                                                {p.name}
                                                            </Link>
                                                            {showStore &&
                                                                p.storeName && (
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {
                                                                            p.storeName
                                                                        }
                                                                    </div>
                                                                )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <StatusPill
                                                        active={p.active}
                                                    />
                                                </td>
                                                <td className="px-5 py-3 text-muted-foreground tabular-nums">
                                                    {p.transactionCount}{' '}
                                                    transaksi
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    {rowActions(p)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </>
                )}
            </div>

            {renameTarget && (
                <RenamePetugasDialog
                    petugas={renameTarget}
                    onClose={() => setRenameTarget(null)}
                />
            )}
            {deleteTarget && (
                <HapusPetugasDialog
                    petugas={deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                />
            )}
        </>
    );
}

function PetugasAvatar({ name, active }: { name: string; active: boolean }) {
    return (
        <span
            className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                active
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted text-muted-foreground',
            )}
        >
            {initials(name)}
        </span>
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

function RowActions({
    petugas,
    onView,
    onActivity,
    onToggle,
    onRename,
    onDelete,
}: {
    petugas: Petugas;
    onView: () => void;
    onActivity: () => void;
    onToggle: () => void;
    onRename: () => void;
    onDelete: () => void;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0">
                    <MoreVertical />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onView}>
                    Lihat detail & riwayat transaksi
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onActivity}>
                    Lihat aktivitas di log
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onRename}>
                    Ubah nama
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onToggle}>
                    {petugas.active ? 'Nonaktifkan' : 'Aktifkan'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                    Hapus
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function TambahPetugasDialog() {
    const [open, setOpen] = useState(false);
    const form = useForm({ name: '' });

    const submit = () =>
        form.post('/pengaturan/petugas', {
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
                    <UserPlus />
                    Tambah Petugas
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Tambah Petugas</DialogTitle>
                    <DialogDescription>
                        Nama ini akan muncul sebagai pilihan saat mencatat
                        transaksi gadai.
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                    }}
                    className="grid gap-1.5"
                >
                    <Label htmlFor="nama">Nama petugas</Label>
                    <Input
                        id="nama"
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        placeholder="cth. Rina"
                        autoFocus
                    />
                    {form.errors.name && (
                        <p className="text-xs text-destructive">
                            {form.errors.name}
                        </p>
                    )}
                </form>
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

function RenamePetugasDialog({
    petugas,
    onClose,
}: {
    petugas: Petugas;
    onClose: () => void;
}) {
    const form = useForm({ name: petugas.name });

    const submit = () =>
        form.put(`/pengaturan/petugas/${petugas.id}`, {
            preserveScroll: true,
            onSuccess: onClose,
        });

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Ubah Nama Petugas</DialogTitle>
                    <DialogDescription>
                        Nama pada transaksi lama tidak berubah.
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                    }}
                    className="grid gap-1.5"
                >
                    <Label htmlFor="rename">Nama petugas</Label>
                    <Input
                        id="rename"
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        autoFocus
                    />
                    {form.errors.name && (
                        <p className="text-xs text-destructive">
                            {form.errors.name}
                        </p>
                    )}
                </form>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Batal
                    </Button>
                    <Button
                        onClick={submit}
                        disabled={form.processing || !form.data.name.trim()}
                    >
                        <UserCog />
                        Simpan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function HapusPetugasDialog({
    petugas,
    onClose,
}: {
    petugas: Petugas;
    onClose: () => void;
}) {
    const [processing, setProcessing] = useState(false);

    const confirm = () => {
        setProcessing(true);
        router.delete(`/pengaturan/petugas/${petugas.id}`, {
            preserveScroll: true,
            onSuccess: onClose,
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Hapus Petugas</DialogTitle>
                    <DialogDescription>
                        Hapus{' '}
                        <span className="font-medium text-foreground">
                            {petugas.name}
                        </span>{' '}
                        dari daftar? Nama pada{' '}
                        {petugas.transactionCount > 0
                            ? `${petugas.transactionCount} transaksi lama`
                            : 'transaksi lama'}{' '}
                        tetap tersimpan, hanya tidak lagi muncul sebagai
                        pilihan.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Batal
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={confirm}
                        disabled={processing}
                    >
                        Hapus
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

KelolaPetugas.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Kelola Petugas', href: '/pengaturan/petugas' },
    ],
};
