import { Head, useForm } from '@inertiajs/react';
import {
    AlarmClock,
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { formatRupiah } from '@/lib/format';

type Rule = { id: number; days: number; percent: number };

type DendaMode = 'off' | 'percent_principal' | 'percent_fee' | 'nominal';

type DendaRule = {
    mode: DendaMode;
    value: number;
    graceDays: number;
    maxDays: number;
};

const DENDA_MODES: { key: DendaMode; label: string }[] = [
    { key: 'off', label: 'Tidak ada denda' },
    { key: 'percent_principal', label: 'Persen dari dana titipan, per hari' },
    { key: 'percent_fee', label: 'Persen dari biaya titipan, per hari' },
    { key: 'nominal', label: 'Nominal tetap, per hari' },
];

export default function PengaturanBiaya({
    approvalThreshold,
    maxDiscountPercent,
    denda,
}: {
    approvalThreshold: number;
    maxDiscountPercent: number;
    denda: DendaRule;
}) {
    const approval = useForm({ approval_threshold: approvalThreshold });
    const discount = useForm({ max_discount_percent: maxDiscountPercent });
    const lateFee = useForm({
        denda_mode: denda.mode,
        denda_value: denda.value,
        denda_grace_days: denda.graceDays,
        denda_max_days: denda.maxDays,
    });

    const saveApproval = () =>
        approval.put('/pengaturan/biaya', { preserveScroll: true });

    const saveDiscount = () =>
        discount.put('/pengaturan/biaya', { preserveScroll: true });

    const saveLateFee = () =>
        lateFee.put('/pengaturan/biaya', { preserveScroll: true });

    // Worked example on a round loan, so the rule is obvious before saving.
    const dendaPerDay = (() => {
        const v = lateFee.data.denda_value;

        switch (lateFee.data.denda_mode) {
            case 'percent_principal':
                return Math.round((1_000_000 * v) / 100);
            case 'percent_fee':
                return Math.round((100_000 * v) / 100);
            case 'nominal':
                return Math.round(v);
            default:
                return 0;
        }
    })();

    const dendaExampleDays = Math.max(
        0,
        Math.min(
            10 - lateFee.data.denda_grace_days,
            lateFee.data.denda_max_days > 0
                ? lateFee.data.denda_max_days
                : Number.MAX_SAFE_INTEGER,
        ),
    );

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
                        <div className="mt-6 border-t pt-5">
                            <h3 className="font-medium">
                                Batas Diskon Biaya Petugas
                            </h3>
                            <p className="mt-1 mb-4 text-xs text-muted-foreground">
                                Kalau petugas memotong biaya titipan lebih dari
                                persentase ini, transaksinya ditandai dan muncul
                                di panel "Perlu Diperiksa" pada Dashboard.
                                Petugas tetap bisa menyimpannya. Isi 0 untuk
                                mematikan penandaan. Pemilik dan admin tidak
                                terkena batas ini.
                            </p>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                <div className="grid gap-1.5 sm:max-w-xs sm:flex-1">
                                    <Label htmlFor="diskon">
                                        Batas potongan
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="diskon"
                                            inputMode="numeric"
                                            value={
                                                discount.data
                                                    .max_discount_percent || ''
                                            }
                                            onChange={(e) =>
                                                discount.setData(
                                                    'max_discount_percent',
                                                    Math.min(
                                                        100,
                                                        parseInt(
                                                            e.target.value.replace(
                                                                /\D/g,
                                                                '',
                                                            ),
                                                            10,
                                                        ) || 0,
                                                    ),
                                                )
                                            }
                                            placeholder="0"
                                            className="pr-8 tabular-nums"
                                        />
                                        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                                            %
                                        </span>
                                    </div>
                                    {discount.errors.max_discount_percent && (
                                        <p className="text-xs text-destructive">
                                            {
                                                discount.errors
                                                    .max_discount_percent
                                            }
                                        </p>
                                    )}
                                </div>
                                <Button
                                    onClick={saveDiscount}
                                    disabled={discount.processing}
                                >
                                    <Save />
                                    Simpan Batas
                                </Button>
                            </div>
                        </div>
                    </section>

                    {/* Late fee */}
                    <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
                        <div className="flex items-center gap-2">
                            <AlarmClock className="size-4 text-overdue" />
                            <h2 className="font-semibold">
                                Denda Keterlambatan
                            </h2>
                        </div>
                        <p className="mt-1 mb-4 text-xs text-muted-foreground">
                            Denda untuk barang yang lewat jatuh tempo dan belum
                            ditebus. Ikut ditagih di Total Tebus, muncul di
                            pesan WhatsApp ke nasabah, dan masuk Kas Harian saat
                            barang ditebus. Pilih "Tidak ada denda" untuk
                            mematikannya.
                        </p>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-1.5 sm:col-span-2">
                                <Label htmlFor="denda-mode">Cara hitung</Label>
                                <Select
                                    value={lateFee.data.denda_mode}
                                    onValueChange={(v) =>
                                        lateFee.setData(
                                            'denda_mode',
                                            v as DendaMode,
                                        )
                                    }
                                >
                                    <SelectTrigger
                                        id="denda-mode"
                                        className="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DENDA_MODES.map((m) => (
                                            <SelectItem
                                                key={m.key}
                                                value={m.key}
                                            >
                                                {m.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {lateFee.data.denda_mode !== 'off' && (
                                <>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="denda-value">
                                            {lateFee.data.denda_mode ===
                                            'nominal'
                                                ? 'Denda per hari'
                                                : 'Persen per hari'}
                                        </Label>
                                        <div className="relative">
                                            {lateFee.data.denda_mode ===
                                                'nominal' && (
                                                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                                                    Rp
                                                </span>
                                            )}
                                            <Input
                                                id="denda-value"
                                                inputMode="decimal"
                                                value={
                                                    lateFee.data.denda_value ||
                                                    ''
                                                }
                                                onChange={(e) =>
                                                    lateFee.setData(
                                                        'denda_value',
                                                        parseFloat(
                                                            e.target.value.replace(
                                                                /[^\d.]/g,
                                                                '',
                                                            ),
                                                        ) || 0,
                                                    )
                                                }
                                                placeholder="0"
                                                className={
                                                    lateFee.data.denda_mode ===
                                                    'nominal'
                                                        ? 'pl-9 tabular-nums'
                                                        : 'pr-8 tabular-nums'
                                                }
                                            />
                                            {lateFee.data.denda_mode !==
                                                'nominal' && (
                                                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                                                    %
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid gap-1.5">
                                        <Label htmlFor="denda-grace">
                                            Masa tenggang
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="denda-grace"
                                                inputMode="numeric"
                                                value={
                                                    lateFee.data
                                                        .denda_grace_days || ''
                                                }
                                                onChange={(e) =>
                                                    lateFee.setData(
                                                        'denda_grace_days',
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
                                                className="pr-16 tabular-nums"
                                            />
                                            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                                                hari
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Hari pertama setelah jatuh tempo
                                            yang dibebaskan dari denda. Isi 0
                                            bila denda langsung berjalan.
                                        </p>
                                    </div>

                                    <div className="grid gap-1.5">
                                        <Label htmlFor="denda-max">
                                            Batas maksimal
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="denda-max"
                                                inputMode="numeric"
                                                value={
                                                    lateFee.data
                                                        .denda_max_days || ''
                                                }
                                                onChange={(e) =>
                                                    lateFee.setData(
                                                        'denda_max_days',
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
                                                className="pr-16 tabular-nums"
                                            />
                                            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                                                hari
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Denda berhenti bertambah setelah
                                            sekian hari. Isi 0 bila tanpa batas.
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        {lateFee.data.denda_mode !== 'off' &&
                            dendaPerDay > 0 && (
                                <p className="mt-4 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                                    Contoh: dana titipan{' '}
                                    <span className="font-medium text-foreground">
                                        Rp 1.000.000
                                    </span>{' '}
                                    dengan biaya titipan Rp 100.000, telat 10
                                    hari. Denda ={' '}
                                    <span className="font-medium text-foreground">
                                        {formatRupiah(dendaPerDay)}
                                    </span>{' '}
                                    x {dendaExampleDays} hari ={' '}
                                    <span className="font-semibold text-foreground">
                                        {formatRupiah(
                                            dendaPerDay * dendaExampleDays,
                                        )}
                                    </span>
                                    .
                                </p>
                            )}

                        <div className="mt-4">
                            <Button
                                onClick={saveLateFee}
                                disabled={lateFee.processing}
                            >
                                <Save />
                                Simpan Denda
                            </Button>
                        </div>
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
