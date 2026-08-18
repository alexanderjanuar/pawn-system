import { Head, router, useForm } from '@inertiajs/react';
import {
    MoreVertical,
    Plus,
    Save,
    Star,
    Trash2,
    Wallet as WalletIcon,
} from 'lucide-react';
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

type WalletRow = {
    id: number;
    name: string;
    isDefault: boolean;
    isActive: boolean;
    usage: number;
};

export default function KelolaDompet({
    wallets,
    canManage,
}: {
    wallets: WalletRow[];
    canManage: boolean;
}) {
    const [editing, setEditing] = useState<WalletRow | null>(null);
    const [deleting, setDeleting] = useState<WalletRow | null>(null);

    return (
        <>
            <Head title="Kelola Dompet" />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <PageHeader
                    title="Kelola Dompet"
                    description="Pisahkan sumber dana kas: uang toko sendiri, pinjaman (mis. Kak Gulam), dan lainnya. Tiap gadai, tebus, atau perpanjang memilih dompetnya."
                >
                    {canManage && <WalletFormDialog />}
                </PageHeader>

                <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    <table className="w-full min-w-[34rem] text-sm">
                        <thead>
                            <tr className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
                                <th className="px-5 py-3 font-medium">Dompet</th>
                                <th className="px-5 py-3 font-medium">Status</th>
                                <th className="px-5 py-3 font-medium">Dipakai</th>
                                {canManage && (
                                    <th className="px-5 py-3 text-right font-medium">
                                        Aksi
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {wallets.map((w) => (
                                <tr key={w.id}>
                                    <td className="px-5 py-3">
                                        <span className="flex items-center gap-2 font-medium">
                                            <WalletIcon className="size-4 text-muted-foreground" />
                                            {w.name}
                                            {w.isDefault && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary ring-1 ring-primary/20 ring-inset">
                                                    <Star className="size-3" />
                                                    Default
                                                </span>
                                            )}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span
                                            className={cn(
                                                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                                                w.isActive
                                                    ? 'bg-aktif-soft text-aktif ring-aktif/25'
                                                    : 'bg-muted text-muted-foreground ring-border',
                                            )}
                                        >
                                            {w.isActive ? 'Aktif' : 'Nonaktif'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-muted-foreground tabular-nums">
                                        {w.usage > 0
                                            ? `${w.usage} transaksi`
                                            : 'Belum dipakai'}
                                    </td>
                                    {canManage && (
                                        <td className="px-5 py-3 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                    >
                                                        <MoreVertical />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        onSelect={() =>
                                                            setEditing(w)
                                                        }
                                                    >
                                                        <Save />
                                                        Ubah nama
                                                    </DropdownMenuItem>
                                                    {!w.isDefault && (
                                                        <DropdownMenuItem
                                                            onSelect={() =>
                                                                router.put(
                                                                    `/pengaturan/dompet/${w.id}`,
                                                                    {
                                                                        is_default:
                                                                            true,
                                                                    },
                                                                    {
                                                                        preserveScroll:
                                                                            true,
                                                                    },
                                                                )
                                                            }
                                                        >
                                                            <Star />
                                                            Jadikan default
                                                        </DropdownMenuItem>
                                                    )}
                                                    {!w.isDefault && (
                                                        <DropdownMenuItem
                                                            onSelect={() =>
                                                                router.put(
                                                                    `/pengaturan/dompet/${w.id}`,
                                                                    {
                                                                        is_active:
                                                                            !w.isActive,
                                                                    },
                                                                    {
                                                                        preserveScroll:
                                                                            true,
                                                                    },
                                                                )
                                                            }
                                                        >
                                                            <WalletIcon />
                                                            {w.isActive
                                                                ? 'Nonaktifkan'
                                                                : 'Aktifkan'}
                                                        </DropdownMenuItem>
                                                    )}
                                                    {!w.isDefault && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                variant="destructive"
                                                                onSelect={() =>
                                                                    setDeleting(
                                                                        w,
                                                                    )
                                                                }
                                                            >
                                                                <Trash2 />
                                                                Hapus
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <WalletFormDialog
                key={editing?.id ?? 'edit'}
                wallet={editing}
                open={editing !== null}
                onOpenChange={(v) => !v && setEditing(null)}
            />

            <Dialog
                open={deleting !== null}
                onOpenChange={(v) => !v && setDeleting(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hapus dompet?</DialogTitle>
                        <DialogDescription>
                            Dompet{' '}
                            <span className="font-medium text-foreground">
                                {deleting?.name}
                            </span>{' '}
                            akan dihapus. Dompet yang sudah dipakai tidak bisa
                            dihapus — nonaktifkan saja.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Batal</Button>
                        </DialogClose>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                if (!deleting) {
                                    return;
                                }

                                router.delete(
                                    `/pengaturan/dompet/${deleting.id}`,
                                    {
                                        preserveScroll: true,
                                        onFinish: () => setDeleting(null),
                                    },
                                );
                            }}
                        >
                            <Trash2 />
                            Hapus
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

/** Add (no wallet) or rename (with wallet) a pocket. */
function WalletFormDialog({
    wallet,
    open,
    onOpenChange,
}: {
    wallet?: WalletRow | null;
    open?: boolean;
    onOpenChange?: (value: boolean) => void;
}) {
    const isEdit = wallet != null;
    const [internalOpen, setInternalOpen] = useState(false);
    const controlled = open !== undefined;
    const isOpen = controlled ? open : internalOpen;
    const setOpen = controlled ? (onOpenChange ?? (() => {})) : setInternalOpen;

    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: wallet?.name ?? '',
    });

    const submit = () => {
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                reset();
            },
        };

        if (isEdit && wallet) {
            put(`/pengaturan/dompet/${wallet.id}`, options);
        } else {
            post('/pengaturan/dompet', options);
        }
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(next) => {
                setOpen(next);

                if (!next) {
                    reset();
                }
            }}
        >
            {!controlled && (
                <DialogTrigger asChild>
                    <Button>
                        <Plus />
                        Tambah Dompet
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? 'Ubah Nama Dompet' : 'Tambah Dompet'}
                    </DialogTitle>
                    <DialogDescription>
                        Nama dompet, mis. "Toko", "Kak Gulam", atau sumber dana
                        lainnya.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-1.5">
                    <Label htmlFor="wallet-name">Nama dompet</Label>
                    <Input
                        id="wallet-name"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        placeholder="mis. Kak Gulam"
                        maxLength={60}
                    />
                    {errors.name && (
                        <p className="text-xs text-destructive">
                            {errors.name}
                        </p>
                    )}
                </div>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Batal</Button>
                    </DialogClose>
                    <Button
                        onClick={submit}
                        disabled={processing || !data.name.trim()}
                    >
                        {isEdit ? <Save /> : <Plus />}
                        {isEdit ? 'Simpan' : 'Tambah'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

KelolaDompet.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Kelola Dompet', href: '/pengaturan/dompet' },
    ],
};
