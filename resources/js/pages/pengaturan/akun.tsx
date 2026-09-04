import { Head, router, useForm } from '@inertiajs/react';
import {
    KeyRound,
    MoreVertical,
    Plus,
    Save,
    ShieldCheck,
    UserPlus,
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn, initials } from '@/lib/utils';

type RoleOption = { value: string; label: string };

type StoreOption = { id: number; name: string };

type Account = {
    id: number;
    name: string;
    email: string;
    role: string;
    roleLabel: string;
    storeId: number | null;
    storeName: string | null;
    active: boolean;
};

type PageProps = {
    users: Account[];
    roles: RoleOption[];
    stores: StoreOption[];
    currentUserId: number;
};

export default function KelolaAkun({
    users,
    roles,
    stores,
    currentUserId,
}: PageProps) {
    const [editTarget, setEditTarget] = useState<Account | null>(null);
    const [passwordTarget, setPasswordTarget] = useState<Account | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

    const toggleActive = (u: Account) =>
        router.put(
            `/pengaturan/akun/${u.id}`,
            { active: !u.active },
            { preserveScroll: true },
        );

    const rowActions = (u: Account) => (
        <RowActions
            account={u}
            isSelf={u.id === currentUserId}
            onEdit={() => setEditTarget(u)}
            onActivity={() =>
                router.visit(`/aktivitas?actor=${encodeURIComponent(u.name)}`)
            }
            onPassword={() => setPasswordTarget(u)}
            onToggle={() => toggleActive(u)}
            onDelete={() => setDeleteTarget(u)}
        />
    );

    return (
        <>
            <Head title="Kelola Akun" />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <PageHeader
                    title="Kelola Akun"
                    description="Akun untuk masuk ke sistem. Akun merujuk ke toko, bukan ke petugas. Hanya Pemilik yang dapat mengelola."
                >
                    <TambahAkunDialog roles={roles} stores={stores} />
                </PageHeader>

                {/* Mobile: cards */}
                <div className="flex flex-col gap-3 sm:hidden">
                    {users.map((u) => (
                        <div
                            key={u.id}
                            className={cn(
                                'rounded-xl border bg-card p-4 shadow-sm',
                                !u.active && 'bg-muted/20',
                            )}
                        >
                            <div className="flex items-start gap-3">
                                <Avatar name={u.name} active={u.active} />
                                <div className="min-w-0 flex-1">
                                    <div
                                        className={cn(
                                            'truncate font-medium',
                                            !u.active &&
                                                'text-muted-foreground',
                                        )}
                                    >
                                        {u.name}
                                        {u.id === currentUserId && (
                                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                                (Anda)
                                            </span>
                                        )}
                                    </div>
                                    <div className="truncate text-xs text-muted-foreground">
                                        {u.email}
                                    </div>
                                </div>
                                {rowActions(u)}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <RolePill role={u.role} label={u.roleLabel} />
                                <StatusPill active={u.active} />
                                {u.storeName && (
                                    <span className="text-xs text-muted-foreground">
                                        {u.storeName}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Desktop: table */}
                <section className="hidden overflow-hidden rounded-xl border bg-card shadow-sm sm:block">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[42rem] text-sm">
                            <thead>
                                <tr className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
                                    <th className="px-5 py-3 font-medium">
                                        Akun
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Peran
                                    </th>
                                    <th className="px-5 py-3 font-medium">
                                        Status
                                    </th>
                                    <th className="px-5 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {users.map((u) => (
                                    <tr
                                        key={u.id}
                                        className={cn(
                                            !u.active && 'bg-muted/20',
                                        )}
                                    >
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-3">
                                                <Avatar
                                                    name={u.name}
                                                    active={u.active}
                                                />
                                                <div className="min-w-0">
                                                    <div
                                                        className={cn(
                                                            'font-medium',
                                                            !u.active &&
                                                                'text-muted-foreground',
                                                        )}
                                                    >
                                                        {u.name}
                                                        {u.id ===
                                                            currentUserId && (
                                                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                                                (Anda)
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {u.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex flex-col gap-1">
                                                <RolePill
                                                    role={u.role}
                                                    label={u.roleLabel}
                                                />
                                                {u.storeName && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {u.storeName}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3">
                                            <StatusPill active={u.active} />
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            {rowActions(u)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            {editTarget && (
                <EditAkunDialog
                    account={editTarget}
                    roles={roles}
                    stores={stores}
                    onClose={() => setEditTarget(null)}
                />
            )}
            {passwordTarget && (
                <ResetPasswordDialog
                    account={passwordTarget}
                    onClose={() => setPasswordTarget(null)}
                />
            )}
            {deleteTarget && (
                <HapusAkunDialog
                    account={deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                />
            )}
        </>
    );
}

function Avatar({ name, active }: { name: string; active: boolean }) {
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

function RolePill({ role, label }: { role: string; label: string }) {
    const management = role === 'owner' || role === 'admin';

    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                role === 'owner'
                    ? 'bg-aktif-soft text-aktif'
                    : role === 'admin'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground',
            )}
        >
            {management && <ShieldCheck className="size-3" />}
            {label}
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
    account,
    isSelf,
    onEdit,
    onActivity,
    onPassword,
    onToggle,
    onDelete,
}: {
    account: Account;
    isSelf: boolean;
    onEdit: () => void;
    onActivity: () => void;
    onPassword: () => void;
    onToggle: () => void;
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
                <DropdownMenuItem onSelect={onActivity}>
                    Lihat aktivitas di log
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
                <DropdownMenuItem onSelect={onPassword}>
                    Reset kata sandi
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onToggle} disabled={isSelf}>
                    {account.active ? 'Nonaktifkan' : 'Aktifkan'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    variant="destructive"
                    onSelect={onDelete}
                    disabled={isSelf}
                >
                    Hapus
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function RoleSelect({
    value,
    roles,
    onChange,
    id,
}: {
    value: string;
    roles: RoleOption[];
    onChange: (value: string) => void;
    id?: string;
}) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger id={id} className="w-full">
                <SelectValue placeholder="Pilih peran" />
            </SelectTrigger>
            <SelectContent>
                {roles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                        {r.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function StoreSelect({
    value,
    stores,
    onChange,
    id,
}: {
    value: string;
    stores: StoreOption[];
    onChange: (value: string) => void;
    id?: string;
}) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger id={id} className="w-full">
                <SelectValue placeholder="Pilih toko" />
            </SelectTrigger>
            <SelectContent>
                {stores.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function TambahAkunDialog({
    roles,
    stores,
}: {
    roles: RoleOption[];
    stores: StoreOption[];
}) {
    const [open, setOpen] = useState(false);
    const form = useForm({
        name: '',
        email: '',
        role: 'petugas',
        store_id: '',
        password: '',
    });

    const submit = () =>
        form.post('/pengaturan/akun', {
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
                    Tambah Akun
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Tambah Akun</DialogTitle>
                    <DialogDescription>
                        Buat akun baru untuk masuk ke sistem.
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                    }}
                    className="grid gap-4"
                >
                    <div className="grid gap-1.5">
                        <Label htmlFor="nama">Nama</Label>
                        <Input
                            id="nama"
                            value={form.data.name}
                            onChange={(e) =>
                                form.setData('name', e.target.value)
                            }
                            placeholder="cth. Siti"
                            autoFocus
                        />
                        {form.errors.name && (
                            <p className="text-xs text-destructive">
                                {form.errors.name}
                            </p>
                        )}
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={form.data.email}
                            onChange={(e) =>
                                form.setData('email', e.target.value)
                            }
                            placeholder="nama@gulamcell.test"
                        />
                        {form.errors.email && (
                            <p className="text-xs text-destructive">
                                {form.errors.email}
                            </p>
                        )}
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="peran">Peran</Label>
                        <RoleSelect
                            id="peran"
                            value={form.data.role}
                            roles={roles}
                            onChange={(v) => form.setData('role', v)}
                        />
                        {form.errors.role && (
                            <p className="text-xs text-destructive">
                                {form.errors.role}
                            </p>
                        )}
                    </div>
                    {form.data.role === 'petugas' && stores.length > 0 && (
                        <div className="grid gap-1.5">
                            <Label htmlFor="toko">Toko</Label>
                            <StoreSelect
                                id="toko"
                                value={form.data.store_id}
                                stores={stores}
                                onChange={(v) => form.setData('store_id', v)}
                            />
                            {form.errors.store_id && (
                                <p className="text-xs text-destructive">
                                    {form.errors.store_id}
                                </p>
                            )}
                        </div>
                    )}
                    <div className="grid gap-1.5">
                        <Label htmlFor="sandi">Kata sandi</Label>
                        <Input
                            id="sandi"
                            type="text"
                            value={form.data.password}
                            onChange={(e) =>
                                form.setData('password', e.target.value)
                            }
                            placeholder="Minimal 8 karakter"
                            className="tabular-nums"
                        />
                        {form.errors.password && (
                            <p className="text-xs text-destructive">
                                {form.errors.password}
                            </p>
                        )}
                    </div>
                </form>
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

function EditAkunDialog({
    account,
    roles,
    stores,
    onClose,
}: {
    account: Account;
    roles: RoleOption[];
    stores: StoreOption[];
    onClose: () => void;
}) {
    const form = useForm({
        name: account.name,
        email: account.email,
        role: account.role,
        store_id: account.storeId ? String(account.storeId) : '',
    });

    const submit = () =>
        form.put(`/pengaturan/akun/${account.id}`, {
            preserveScroll: true,
            onSuccess: onClose,
        });

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Akun</DialogTitle>
                    <DialogDescription>
                        Ubah nama, email, atau peran akun.
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                    }}
                    className="grid gap-4"
                >
                    <div className="grid gap-1.5">
                        <Label htmlFor="edit-nama">Nama</Label>
                        <Input
                            id="edit-nama"
                            value={form.data.name}
                            onChange={(e) =>
                                form.setData('name', e.target.value)
                            }
                            autoFocus
                        />
                        {form.errors.name && (
                            <p className="text-xs text-destructive">
                                {form.errors.name}
                            </p>
                        )}
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="edit-email">Email</Label>
                        <Input
                            id="edit-email"
                            type="email"
                            value={form.data.email}
                            onChange={(e) =>
                                form.setData('email', e.target.value)
                            }
                        />
                        {form.errors.email && (
                            <p className="text-xs text-destructive">
                                {form.errors.email}
                            </p>
                        )}
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="edit-peran">Peran</Label>
                        <RoleSelect
                            id="edit-peran"
                            value={form.data.role}
                            roles={roles}
                            onChange={(v) => form.setData('role', v)}
                        />
                        {form.errors.role && (
                            <p className="text-xs text-destructive">
                                {form.errors.role}
                            </p>
                        )}
                    </div>
                    {form.data.role === 'petugas' && stores.length > 0 && (
                        <div className="grid gap-1.5">
                            <Label htmlFor="edit-toko">Toko</Label>
                            <StoreSelect
                                id="edit-toko"
                                value={form.data.store_id}
                                stores={stores}
                                onChange={(v) => form.setData('store_id', v)}
                            />
                            {form.errors.store_id && (
                                <p className="text-xs text-destructive">
                                    {form.errors.store_id}
                                </p>
                            )}
                        </div>
                    )}
                </form>
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

function ResetPasswordDialog({
    account,
    onClose,
}: {
    account: Account;
    onClose: () => void;
}) {
    const form = useForm({ password: '' });

    const submit = () =>
        form.put(`/pengaturan/akun/${account.id}/password`, {
            preserveScroll: true,
            onSuccess: onClose,
        });

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reset Kata Sandi</DialogTitle>
                    <DialogDescription>
                        Buat kata sandi baru untuk{' '}
                        <span className="font-medium text-foreground">
                            {account.name}
                        </span>
                        . Beri tahu pemilik akun.
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                    }}
                    className="grid gap-1.5"
                >
                    <Label htmlFor="new-password">Kata sandi baru</Label>
                    <Input
                        id="new-password"
                        type="text"
                        value={form.data.password}
                        onChange={(e) =>
                            form.setData('password', e.target.value)
                        }
                        placeholder="Minimal 8 karakter"
                        className="tabular-nums"
                        autoFocus
                    />
                    {form.errors.password && (
                        <p className="text-xs text-destructive">
                            {form.errors.password}
                        </p>
                    )}
                </form>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Batal
                    </Button>
                    <Button
                        onClick={submit}
                        disabled={form.processing || !form.data.password.trim()}
                    >
                        <KeyRound />
                        Simpan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function HapusAkunDialog({
    account,
    onClose,
}: {
    account: Account;
    onClose: () => void;
}) {
    const [processing, setProcessing] = useState(false);

    const confirm = () => {
        setProcessing(true);
        router.delete(`/pengaturan/akun/${account.id}`, {
            preserveScroll: true,
            onSuccess: onClose,
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Hapus Akun</DialogTitle>
                    <DialogDescription>
                        Hapus akun{' '}
                        <span className="font-medium text-foreground">
                            {account.name}
                        </span>{' '}
                        ({account.email})? Akun tidak bisa lagi masuk ke sistem.
                        Tindakan ini tidak dapat dibatalkan.
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

KelolaAkun.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Kelola Akun', href: '/pengaturan/akun' },
    ],
};
