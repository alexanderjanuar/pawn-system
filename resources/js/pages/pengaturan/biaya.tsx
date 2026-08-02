import { Head, useForm } from '@inertiajs/react';
import {
    Gavel,
    MessageCircle,
    Plus,
    Save,
    ShieldCheck,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/gadai/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatRupiah } from '@/lib/format';

type Rule = { id: number; days: number; percent: number };

export default function PengaturanBiaya({
    approvalThreshold,
}: {
    approvalThreshold: number;
}) {
    const approval = useForm({ approval_threshold: approvalThreshold });

    const saveApproval = () =>
        approval.put('/pengaturan/biaya', { preserveScroll: true });

    const [rules, setRules] = useState<Rule[]>([
        { id: 1, days: 15, percent: 10 },
        { id: 2, days: 30, percent: 15 },
    ]);
    const [allowCustom, setAllowCustom] = useState(true);
    const [lelangDays, setLelangDays] = useState(7);
    const [reminders, setReminders] = useState({
        h3: true,
        h1: true,
        hari_h: true,
        lewat: true,
    });

    const updateRule = (id: number, key: keyof Rule, value: number) =>
        setRules((prev) =>
            prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)),
        );
    const addRule = () =>
        setRules((prev) => [
            ...prev,
            {
                id: Math.max(0, ...prev.map((r) => r.id)) + 1,
                days: 45,
                percent: 20,
            },
        ]);
    const removeRule = (id: number) =>
        setRules((prev) => prev.filter((r) => r.id !== id));

    const save = () =>
        toast.success('Pengaturan biaya disimpan (preview)', {
            description: 'Perubahan akan berlaku untuk transaksi baru.',
        });

    return (
        <>
            <Head title="Pengaturan Biaya" />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <PageHeader
                    title="Pengaturan Biaya"
                    description="Atur biaya titipan, pelelangan otomatis, dan pengingat. Hanya Pemilik."
                >
                    <Button onClick={save}>
                        <Save />
                        Simpan
                    </Button>
                </PageHeader>

                <div className="grid gap-5 lg:grid-cols-2">
                    {/* Persetujuan pencairan */}
                    <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-6 lg:col-span-2">
                        <div className="mb-1 flex items-center gap-2">
                            <ShieldCheck className="size-4.5 text-primary" />
                            <h2 className="font-semibold">
                                Persetujuan Pencairan
                            </h2>
                        </div>
                        <p className="mb-4 text-xs text-muted-foreground">
                            Pinjaman di atas nominal ini yang dibuat petugas
                            harus disetujui Pemilik sebelum dana dicairkan.
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                            <div className="grid gap-1.5 sm:max-w-xs sm:flex-1">
                                <Label htmlFor="threshold">
                                    Ambang minimum
                                </Label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                                        Rp
                                    </span>
                                    <Input
                                        id="threshold"
                                        inputMode="numeric"
                                        value={
                                            approval.data.approval_threshold
                                                ? approval.data.approval_threshold.toLocaleString(
                                                      'id-ID',
                                                  )
                                                : ''
                                        }
                                        onChange={(e) =>
                                            approval.setData(
                                                'approval_threshold',
                                                parseInt(
                                                    e.target.value.replace(
                                                        /\D/g,
                                                        '',
                                                    ),
                                                    10,
                                                ) || 0,
                                            )
                                        }
                                        placeholder="0"
                                        className="pl-9 tabular-nums"
                                    />
                                </div>
                                {approval.errors.approval_threshold && (
                                    <p className="text-xs text-destructive">
                                        {approval.errors.approval_threshold}
                                    </p>
                                )}
                            </div>
                            <Button
                                onClick={saveApproval}
                                disabled={approval.processing}
                            >
                                <Save />
                                Simpan Ambang
                            </Button>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                            Saat ini pinjaman di atas{' '}
                            <span className="font-medium text-foreground">
                                {formatRupiah(approvalThreshold)}
                            </span>{' '}
                            memerlukan persetujuan Pemilik.
                        </p>
                    </section>

                    {/* Fee rules */}
                    <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-6 lg:col-span-2">
                        <h2 className="font-semibold">Aturan Biaya Titipan</h2>
                        <p className="mb-4 text-xs text-muted-foreground">
                            Biaya dihitung otomatis dari dana titipan
                            berdasarkan jangka waktu.
                        </p>

                        <div className="space-y-2">
                            <div className="grid grid-cols-[1fr_1fr_auto] gap-3 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                <span>Jangka (hari)</span>
                                <span>Persentase biaya</span>
                                <span className="sr-only">Aksi</span>
                            </div>
                            {rules.map((rule) => (
                                <div
                                    key={rule.id}
                                    className="grid grid-cols-[1fr_1fr_auto] items-center gap-3"
                                >
                                    <Input
                                        type="number"
                                        min={1}
                                        value={rule.days}
                                        onChange={(e) =>
                                            updateRule(
                                                rule.id,
                                                'days',
                                                parseInt(e.target.value, 10) ||
                                                    0,
                                            )
                                        }
                                        className="no-spinner tabular-nums"
                                    />
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            min={0}
                                            value={rule.percent}
                                            onChange={(e) =>
                                                updateRule(
                                                    rule.id,
                                                    'percent',
                                                    parseInt(
                                                        e.target.value,
                                                        10,
                                                    ) || 0,
                                                )
                                            }
                                            className="no-spinner pr-8 tabular-nums"
                                        />
                                        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                                            %
                                        </span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeRule(rule.id)}
                                        disabled={rules.length <= 1}
                                        title="Hapus aturan"
                                    >
                                        <Trash2 className="text-muted-foreground" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={addRule}
                            className="mt-3"
                        >
                            <Plus />
                            Tambah Aturan
                        </Button>

                        <label className="mt-5 flex items-start gap-3 rounded-lg border p-3">
                            <Checkbox
                                checked={allowCustom}
                                onCheckedChange={(v) => setAllowCustom(!!v)}
                                className="mt-0.5"
                            />
                            <span className="text-sm">
                                <span className="font-medium">
                                    Izinkan biaya custom oleh petugas
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                    Petugas dapat mengatur persentase & jangka
                                    waktu manual saat input transaksi.
                                </span>
                            </span>
                        </label>
                    </section>

                    {/* Auto-lelang */}
                    <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
                        <div className="mb-4 flex items-center gap-2">
                            <Gavel className="size-4.5 text-lelang" />
                            <h2 className="font-semibold">
                                Pelelangan Otomatis
                            </h2>
                        </div>
                        <Label htmlFor="lelang" className="text-sm">
                            Tandai <span className="font-medium">Lelang</span>{' '}
                            otomatis setelah
                        </Label>
                        <div className="mt-2 flex items-center gap-2">
                            <Input
                                id="lelang"
                                type="number"
                                min={1}
                                value={lelangDays}
                                onChange={(e) =>
                                    setLelangDays(
                                        parseInt(e.target.value, 10) || 0,
                                    )
                                }
                                className="no-spinner w-20 tabular-nums"
                            />
                            <span className="text-sm text-muted-foreground">
                                hari lewat jatuh tempo tanpa kabar
                            </span>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                            Barang otomatis ditandai untuk lelang bila pelanggan
                            tidak menebus atau memperpanjang dalam batas ini.
                        </p>
                    </section>

                    {/* WhatsApp reminders */}
                    <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
                        <div className="mb-4 flex items-center gap-2">
                            <MessageCircle className="size-4.5 text-perpanjang" />
                            <h2 className="font-semibold">
                                Pengingat WhatsApp
                            </h2>
                        </div>
                        <div className="space-y-1">
                            {[
                                {
                                    key: 'h3',
                                    label: '3 hari sebelum jatuh tempo',
                                },
                                {
                                    key: 'h1',
                                    label: '1 hari sebelum jatuh tempo',
                                },
                                {
                                    key: 'hari_h',
                                    label: 'Pada hari jatuh tempo',
                                },
                                {
                                    key: 'lewat',
                                    label: 'Setelah lewat jatuh tempo',
                                },
                            ].map((item) => (
                                <label
                                    key={item.key}
                                    className="flex items-center gap-3 rounded-md px-1 py-2 text-sm"
                                >
                                    <Checkbox
                                        checked={
                                            reminders[
                                                item.key as keyof typeof reminders
                                            ]
                                        }
                                        onCheckedChange={(v) =>
                                            setReminders((prev) => ({
                                                ...prev,
                                                [item.key]: !!v,
                                            }))
                                        }
                                    />
                                    {item.label}
                                </label>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
}

PengaturanBiaya.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Pengaturan Biaya', href: '/pengaturan/biaya' },
    ],
};
