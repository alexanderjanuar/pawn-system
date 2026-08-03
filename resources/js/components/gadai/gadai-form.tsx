import { Head, Link, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    CalendarClock,
    Hash,
    History,
    IdCard,
    Info,
    Printer,
    Save,
    ShieldAlert,
    ShieldCheck,
    Smartphone,
    User,
    Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { toast } from 'sonner';
import { CustomerCombobox } from '@/components/gadai/customer-combobox';
import { DatePicker } from '@/components/gadai/date-picker';
import { FileDropzone } from '@/components/gadai/file-dropzone';
import { PageHeader } from '@/components/gadai/page-header';
import { PhotoUploader } from '@/components/gadai/photo-uploader';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { addDays, formatDate, formatRupiah, TODAY } from '@/lib/format';
import { computeFee, PHOTO_LABELS, STATUS_META, STATUS_ORDER } from '@/lib/gadai';
import { cn, initials } from '@/lib/utils';
import type {
    Customer,
    GadaiStatus,
    Kelengkapan,
    Transaction,
} from '@/types/gadai';

type TenorChoice = '15' | '30' | 'custom';

const KELENGKAPAN: Kelengkapan[] = [
    'HP saja',
    'HP + Box',
    'HP + Charger',
    'HP + Box + Charger',
];

const RAM_OPTIONS = ['3 GB', '4 GB', '6 GB', '8 GB', '12 GB', '16 GB'];
const STORAGE_OPTIONS = [
    '32 GB',
    '64 GB',
    '128 GB',
    '256 GB',
    '512 GB',
    '1 TB',
];

function tenorChoiceOf(tx: Transaction): TenorChoice {
    if (tx.tenorDays === 15 && tx.feePercent === 10) {
        return '15';
    }

    if (tx.tenorDays === 30 && tx.feePercent === 15) {
        return '30';
    }

    return 'custom';
}

export function GadaiForm({
    mode,
    customers,
    petugasList,
    rakList,
    transaction,
    suggestedCode,
    notaPrefix = 'GCG',
    today,
}: {
    mode: 'create' | 'edit';
    customers: Customer[];
    petugasList: string[];
    rakList: { id: number; name: string }[];
    transaction?: Transaction;
    /** Next auto number for `today` (create mode), e.g. GCG-20260730-0001. */
    suggestedCode?: string;
    /** The active store's nota prefix, e.g. GCG. */
    notaPrefix?: string;
    /** Server "today" as YYYY-MM-DD, used as the default start date. */
    today?: string;
}) {
    const isEdit = mode === 'edit';
    const page = usePage().props;
    const role = page.auth.user?.role;
    const isManagement = role === 'owner' || role === 'admin';
    const approvalThreshold = page.approvalThreshold;

    const preselected = useMemo(() => {
        if (transaction?.customerCode) {
            return (
                customers.find((c) => c.id === transaction.customerCode) ?? null
            );
        }

        if (typeof window === 'undefined') {
            return null;
        }

        const code = new URLSearchParams(window.location.search).get(
            'pelanggan',
        );

        return code ? (customers.find((c) => c.id === code) ?? null) : null;
    }, [customers, transaction]);

    const { data, setData, post, processing, errors, transform } = useForm({
        code_mode: 'auto',
        code: '',
        customer_mode: 'existing',
        customer_code: preselected?.id ?? '',
        name: '',
        phone: '',
        address: '',
        id_number: '',
        device_owner: transaction?.deviceOwner ?? '',
        device_name: transaction?.device.name ?? '',
        device_ram: transaction?.device.ram ?? '',
        device_storage: transaction?.device.storage ?? '',
        device_serial: transaction?.device.serial ?? '',
        imei_1: transaction?.device.imei1 ?? '',
        imei_2: transaction?.device.imei2 ?? '',
        kelengkapan: (transaction?.device.kelengkapan ??
            'HP + Box + Charger') as Kelengkapan,
        status: transaction?.status ?? 'AKTIF',
        clerk: transaction?.clerk ?? '',
        rak_id: transaction?.rakId ? String(transaction.rakId) : 'none',
        principal: transaction?.principal ?? 0,
        tenor_choice: (transaction
            ? tenorChoiceOf(transaction)
            : '15') as TenorChoice,
        custom_days: transaction?.tenorDays ?? 15,
        custom_percent: transaction?.feePercent ?? 10,
        fee_mode: 'nominal' as 'percent' | 'nominal',
        custom_fee: transaction?.fee ?? 0,
        start_date:
            transaction?.startDate ?? today ?? TODAY.toISOString().slice(0, 10),
        notes: transaction?.notes ?? '',
        photos: [] as File[],
        photo_labels: [] as string[],
        ktp: [] as File[],
    });

    const selectedCustomer = data.customer_code
        ? (customers.find((c) => c.id === data.customer_code) ?? null)
        : null;

    // Warn if the chosen (or entered) customer is blacklisted.
    const blacklistMatch = useMemo(() => {
        if (data.customer_mode === 'existing') {
            return selectedCustomer?.blacklisted ? selectedCustomer : null;
        }

        const nik = data.id_number.trim();
        const hp = data.phone.replace(/\D/g, '');

        if (!nik && hp.length < 6) {
            return null;
        }

        return (
            customers.find(
                (c) =>
                    c.blacklisted &&
                    ((nik.length >= 6 && c.idNumber.trim() === nik) ||
                        (hp.length >= 6 && c.phone.replace(/\D/g, '') === hp)),
            ) ?? null
        );
    }, [
        data.customer_mode,
        data.id_number,
        data.phone,
        selectedCustomer,
        customers,
    ]);

    const calc = useMemo(() => {
        const tenorDays =
            data.tenor_choice === '15'
                ? 15
                : data.tenor_choice === '30'
                  ? 30
                  : Math.max(1, data.custom_days || 0);

        let percent: number;
        let fee: number;

        if (data.tenor_choice === '15') {
            percent = 10;
            fee = computeFee(data.principal, percent);
        } else if (data.tenor_choice === '30') {
            percent = 15;
            fee = computeFee(data.principal, percent);
        } else if (data.fee_mode === 'nominal') {
            // Custom nominal: the rupiah fee is the source; percent is derived.
            fee = Math.max(0, data.custom_fee || 0);
            percent =
                data.principal > 0
                    ? Math.round((fee / data.principal) * 100)
                    : 0;
        } else {
            percent = Math.max(0, data.custom_percent || 0);
            fee = computeFee(data.principal, percent);
        }

        return {
            tenorDays,
            percent,
            fee,
            total: data.principal + fee,
            dueDate: addDays(data.start_date, tenorDays),
        };
    }, [
        data.principal,
        data.tenor_choice,
        data.custom_days,
        data.custom_percent,
        data.custom_fee,
        data.fee_mode,
        data.start_date,
    ]);

    /**
     * Live preview of the auto nota number for the chosen start date. The final
     * number is assigned by the server on save; the sequence shown here is exact
     * for today's date and falls back to 0001 for other dates.
     */
    const autoCode = useMemo(() => {
        const ymd = data.start_date.replace(/-/g, '');

        if (!suggestedCode) {
            return `${notaPrefix}-${ymd}-0001`;
        }

        const parts = suggestedCode.split('-');
        const seq = parts[1] === ymd ? parts[2] : '0001';

        return `${notaPrefix}-${ymd}-${seq}`;
    }, [data.start_date, suggestedCode, notaPrefix]);

    // The stored clerk may be inactive or removed from the roster (older
    // transactions), so keep it selectable to never silently drop it on edit.
    const petugasOptions = useMemo(() => {
        if (data.clerk && !petugasList.includes(data.clerk)) {
            return [data.clerk, ...petugasList];
        }

        return petugasList;
    }, [petugasList, data.clerk]);

    const customerName =
        data.customer_mode === 'existing'
            ? (selectedCustomer?.name ?? '')
            : data.name.trim();

    const onPrincipalChange = (raw: string) => {
        const digits = raw.replace(/\D/g, '');
        setData('principal', digits ? parseInt(digits, 10) : 0);
    };

    const submit = (e: FormEvent, cetak = false) => {
        e.preventDefault();
        const onError = () =>
            toast.error('Periksa kembali data yang diisi.', {
                description: 'Ada isian yang belum lengkap atau tidak valid.',
            });

        if (isEdit && transaction) {
            transform((current) => ({
                ...current,
                ktp: current.ktp[0] ?? null,
                rak_id: current.rak_id === 'none' ? null : current.rak_id,
                _method: 'put',
            }));
            post(`/transaksi/${transaction.id}`, {
                forceFormData: true,
                onError,
            });

            return;
        }

        transform((current) => ({
            ...current,
            ktp: current.ktp[0] ?? null,
            rak_id: current.rak_id === 'none' ? null : current.rak_id,
            cetak: cetak ? 1 : 0,
        }));
        post('/gadai', { forceFormData: true, onError });
    };

    return (
        <>
            <Head title={isEdit ? `Edit ${transaction?.id}` : 'Gadai Baru'} />
            <form
                onSubmit={(e) => submit(e)}
                className="flex flex-col gap-5 p-4 sm:p-6"
            >
                <PageHeader
                    title={isEdit ? `Edit ${transaction?.id}` : 'Gadai Baru'}
                    description={
                        isEdit
                            ? 'Perbarui data transaksi gadai.'
                            : 'Catat barang masuk. Biaya titipan dihitung otomatis oleh sistem.'
                    }
                >
                    <Button variant="outline" asChild type="button">
                        <Link
                            href={
                                isEdit && transaction
                                    ? `/transaksi/${transaction.id}`
                                    : '/transaksi'
                            }
                        >
                            Batal
                        </Link>
                    </Button>
                </PageHeader>

                <div className="grid gap-5 lg:grid-cols-3">
                    <div className="flex flex-col gap-5 lg:col-span-2">
                        {!isEdit && (
                            <SectionCard
                                icon={Hash}
                                title="Nomor Nota"
                                description="Dibuat otomatis oleh sistem, atau isi manual."
                            >
                                <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
                                    <Field label="Mode penomoran">
                                        <ToggleGroup
                                            type="single"
                                            variant="outline"
                                            value={data.code_mode}
                                            onValueChange={(v) =>
                                                v && setData('code_mode', v)
                                            }
                                        >
                                            <ToggleGroupItem
                                                value="auto"
                                                className="px-4"
                                            >
                                                Otomatis
                                            </ToggleGroupItem>
                                            <ToggleGroupItem
                                                value="manual"
                                                className="px-4"
                                            >
                                                Manual
                                            </ToggleGroupItem>
                                        </ToggleGroup>
                                    </Field>
                                    <Field
                                        label="Nomor nota"
                                        htmlFor="nota"
                                        hint={
                                            data.code_mode === 'manual'
                                                ? (errors.code ??
                                                  'Harus unik. Contoh: GCG-20260730-0001')
                                                : 'Nomor final ditetapkan saat transaksi disimpan.'
                                        }
                                    >
                                        <div className="relative">
                                            <Input
                                                id="nota"
                                                value={
                                                    data.code_mode === 'auto'
                                                        ? autoCode
                                                        : data.code
                                                }
                                                onChange={(e) =>
                                                    setData(
                                                        'code',
                                                        e.target.value,
                                                    )
                                                }
                                                disabled={
                                                    data.code_mode === 'auto'
                                                }
                                                placeholder="cth. GCG-20260730-0001"
                                                className={cn(
                                                    'font-medium tabular-nums',
                                                    data.code_mode === 'auto' &&
                                                        'pr-24',
                                                )}
                                            />
                                            {data.code_mode === 'auto' && (
                                                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                                    otomatis
                                                </span>
                                            )}
                                        </div>
                                    </Field>
                                </div>
                            </SectionCard>
                        )}

                        <SectionCard
                            icon={User}
                            title="Data Pelanggan"
                            description="Cari pelanggan lama atau daftarkan yang baru."
                        >
                            <div className="flex flex-col gap-4">
                                {blacklistMatch && (
                                    <div className="flex items-start gap-2 rounded-lg border border-lelang/30 bg-lelang-soft/40 p-3 text-sm">
                                        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-lelang" />
                                        <div>
                                            <p className="font-medium text-lelang">
                                                Pelanggan diblacklist
                                            </p>
                                            <p className="text-muted-foreground">
                                                {blacklistMatch.name} (
                                                {blacklistMatch.id}) ditandai:{' '}
                                                {blacklistMatch.blacklistReason ??
                                                    'bermasalah'}
                                                . Pertimbangkan sebelum lanjut.
                                            </p>
                                        </div>
                                    </div>
                                )}
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    value={data.customer_mode}
                                    onValueChange={(v) => {
                                        if (!v) {
                                            return;
                                        }

                                        setData('customer_mode', v);

                                        if (v === 'new') {
                                            setData('customer_code', '');
                                        }
                                    }}
                                    className="w-full sm:w-auto"
                                >
                                    <ToggleGroupItem
                                        value="existing"
                                        className="flex-1 px-4 sm:flex-none"
                                    >
                                        Pelanggan Lama
                                    </ToggleGroupItem>
                                    <ToggleGroupItem
                                        value="new"
                                        className="flex-1 px-4 sm:flex-none"
                                    >
                                        Pelanggan Baru
                                    </ToggleGroupItem>
                                </ToggleGroup>

                                {data.customer_mode === 'existing' ? (
                                    selectedCustomer ? (
                                        <div className="flex flex-col gap-3">
                                            <SelectedCustomerCard
                                                customer={selectedCustomer}
                                                onChange={() =>
                                                    setData('customer_code', '')
                                                }
                                            />
                                            <CustomerHistory
                                                customer={selectedCustomer}
                                                currentId={
                                                    isEdit
                                                        ? transaction?.id
                                                        : null
                                                }
                                            />
                                        </div>
                                    ) : (
                                        <Field
                                            label="Cari pelanggan"
                                            hint={errors.customer_code}
                                        >
                                            <CustomerCombobox
                                                customers={customers}
                                                value={selectedCustomer}
                                                onSelect={(c) =>
                                                    setData(
                                                        'customer_code',
                                                        c.id,
                                                    )
                                                }
                                                onAddNew={() =>
                                                    setData(
                                                        'customer_mode',
                                                        'new',
                                                    )
                                                }
                                            />
                                        </Field>
                                    )
                                ) : (
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <Field
                                            label="Nama pelanggan"
                                            htmlFor="nama"
                                            className="sm:col-span-2"
                                            hint={errors.name}
                                        >
                                            <Input
                                                id="nama"
                                                value={data.name}
                                                onChange={(e) =>
                                                    setData(
                                                        'name',
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="cth. Budi Santoso"
                                            />
                                        </Field>
                                        <Field
                                            label="Nomor HP"
                                            htmlFor="hp"
                                            hint={errors.phone}
                                        >
                                            <Input
                                                id="hp"
                                                inputMode="numeric"
                                                value={data.phone}
                                                onChange={(e) =>
                                                    setData(
                                                        'phone',
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="cth. 0812-3344-5566"
                                            />
                                        </Field>
                                        <Field label="No. KTP" htmlFor="ktp-no">
                                            <Input
                                                id="ktp-no"
                                                inputMode="numeric"
                                                value={data.id_number}
                                                onChange={(e) =>
                                                    setData(
                                                        'id_number',
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="16 digit"
                                            />
                                        </Field>
                                        <Field
                                            label="Alamat"
                                            htmlFor="alamat"
                                            className="sm:col-span-2"
                                        >
                                            <Input
                                                id="alamat"
                                                value={data.address}
                                                onChange={(e) =>
                                                    setData(
                                                        'address',
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="Jl. Serayu No. …, Tanah Merah"
                                            />
                                        </Field>
                                    </div>
                                )}

                                <Field
                                    label="Pemilik device"
                                    htmlFor="pemilik"
                                    hint="Isi bila berbeda dari pelanggan."
                                    className="sm:max-w-sm"
                                >
                                    <Input
                                        id="pemilik"
                                        value={data.device_owner}
                                        onChange={(e) =>
                                            setData(
                                                'device_owner',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Sama dengan pelanggan"
                                    />
                                </Field>
                            </div>
                        </SectionCard>

                        <SectionCard
                            icon={Smartphone}
                            title="Detail Barang"
                            description="Spesifikasi HP yang digadaikan."
                        >
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field
                                    label="Nama HP"
                                    htmlFor="device"
                                    className="sm:col-span-2"
                                    hint={errors.device_name}
                                >
                                    <Input
                                        id="device"
                                        value={data.device_name}
                                        onChange={(e) =>
                                            setData(
                                                'device_name',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="cth. iPhone 13 Pro"
                                    />
                                </Field>
                                <Field label="RAM">
                                    <Select
                                        value={data.device_ram}
                                        onValueChange={(v) =>
                                            setData('device_ram', v)
                                        }
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Pilih RAM" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {RAM_OPTIONS.map((r) => (
                                                <SelectItem key={r} value={r}>
                                                    {r}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <Field label="Memori Internal">
                                    <Select
                                        value={data.device_storage}
                                        onValueChange={(v) =>
                                            setData('device_storage', v)
                                        }
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Pilih memori" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {STORAGE_OPTIONS.map((s) => (
                                                <SelectItem key={s} value={s}>
                                                    {s}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <Field
                                    label="Nomor Seri"
                                    htmlFor="serial"
                                    className="sm:col-span-2"
                                >
                                    <Input
                                        id="serial"
                                        value={data.device_serial}
                                        onChange={(e) =>
                                            setData(
                                                'device_serial',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Nomor seri perangkat"
                                    />
                                </Field>
                                <ImeiField
                                    id="imei1"
                                    label="IMEI 1"
                                    value={data.imei_1}
                                    onChange={(v) => setData('imei_1', v)}
                                    excludeCode={isEdit ? transaction?.id : null}
                                />
                                <ImeiField
                                    id="imei2"
                                    label="IMEI 2"
                                    value={data.imei_2}
                                    onChange={(v) => setData('imei_2', v)}
                                    excludeCode={isEdit ? transaction?.id : null}
                                />
                                <Field
                                    label="Kelengkapan"
                                    className="sm:col-span-2"
                                >
                                    <ToggleGroup
                                        type="single"
                                        variant="outline"
                                        value={data.kelengkapan}
                                        onValueChange={(v) =>
                                            v &&
                                            setData(
                                                'kelengkapan',
                                                v as Kelengkapan,
                                            )
                                        }
                                        className="flex-wrap justify-start"
                                    >
                                        {KELENGKAPAN.map((k) => (
                                            <ToggleGroupItem
                                                key={k}
                                                value={k}
                                                className="px-3.5"
                                            >
                                                {k}
                                            </ToggleGroupItem>
                                        ))}
                                    </ToggleGroup>
                                </Field>
                            </div>
                        </SectionCard>

                        <SectionCard
                            icon={IdCard}
                            title="Foto & Dokumen"
                            description={
                                isEdit
                                    ? 'Foto baru akan ditambahkan ke yang sudah ada.'
                                    : 'Tersimpan di transaksi ini.'
                            }
                        >
                            {isEdit &&
                                ((transaction?.photos?.length ?? 0) > 0 ||
                                    transaction?.ktp) && (
                                    <div className="mb-4">
                                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                                            Foto saat ini
                                        </p>
                                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                                            {transaction?.photos?.map((p) => (
                                                <div
                                                    key={p.url}
                                                    className="relative aspect-square overflow-hidden rounded-md border bg-muted"
                                                >
                                                    <img
                                                        src={p.url}
                                                        alt={
                                                            p.label ??
                                                            'Foto barang'
                                                        }
                                                        className="size-full object-cover"
                                                    />
                                                    {p.label && (
                                                        <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[9px] font-medium text-white">
                                                            {p.label}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                            {transaction?.ktp && (
                                                <img
                                                    src={transaction.ktp}
                                                    alt="Scan KTP"
                                                    className="aspect-square w-full rounded-md border object-cover"
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}
                            <div className="flex flex-col gap-4">
                                <PhotoUploader
                                    id="foto"
                                    label={
                                        isEdit ? 'Tambah Foto' : 'Foto Barang'
                                    }
                                    hint="JPG/PNG, bisa lebih dari satu · beri label opsional"
                                    suggestions={PHOTO_LABELS}
                                    files={data.photos}
                                    labels={data.photo_labels}
                                    onChange={(files, photoLabels) => {
                                        setData('photos', files);
                                        setData('photo_labels', photoLabels);
                                    }}
                                />
                                <div className="sm:max-w-xs">
                                    <FileDropzone
                                        id="ktp"
                                        label={
                                            isEdit
                                                ? 'Ganti Scan KTP'
                                                : 'Scan KTP'
                                        }
                                        hint="JPG/PNG, 1 file"
                                        value={data.ktp}
                                        onChange={(files) =>
                                            setData('ktp', files)
                                        }
                                    />
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard
                            icon={Wallet}
                            title="Dana & Biaya Titipan"
                            description="Pilih jangka waktu, biaya dihitung otomatis."
                        >
                            <div className="grid gap-4 sm:grid-cols-2">
                                {isEdit && (
                                    <Field
                                        label="Status"
                                        className="sm:col-span-2 sm:max-w-xs"
                                    >
                                        <Select
                                            value={data.status}
                                            onValueChange={(v) =>
                                                setData(
                                                    'status',
                                                    v as GadaiStatus,
                                                )
                                            }
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {STATUS_ORDER.map((s) => (
                                                    <SelectItem
                                                        key={s}
                                                        value={s}
                                                    >
                                                        {STATUS_META[s].label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                )}

                                <Field
                                    label="Dana titipan"
                                    htmlFor="dana"
                                    className="sm:col-span-2"
                                    hint={errors.principal}
                                >
                                    <div className="relative">
                                        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                                            Rp
                                        </span>
                                        <Input
                                            id="dana"
                                            inputMode="numeric"
                                            value={
                                                data.principal
                                                    ? data.principal.toLocaleString(
                                                          'id-ID',
                                                      )
                                                    : ''
                                            }
                                            onChange={(e) =>
                                                onPrincipalChange(
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="0"
                                            className="pl-9 text-base font-medium tabular-nums"
                                        />
                                    </div>
                                </Field>

                                <Field
                                    label="Jangka waktu"
                                    className="sm:col-span-2"
                                >
                                    <ToggleGroup
                                        type="single"
                                        variant="outline"
                                        value={data.tenor_choice}
                                        onValueChange={(v) =>
                                            v &&
                                            setData(
                                                'tenor_choice',
                                                v as TenorChoice,
                                            )
                                        }
                                        className="w-full"
                                    >
                                        <ToggleGroupItem
                                            value="15"
                                            className="h-auto flex-1 flex-col gap-0 py-2"
                                        >
                                            <span className="font-medium">
                                                15 Hari
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                biaya 10%
                                            </span>
                                        </ToggleGroupItem>
                                        <ToggleGroupItem
                                            value="30"
                                            className="h-auto flex-1 flex-col gap-0 py-2"
                                        >
                                            <span className="font-medium">
                                                30 Hari
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                biaya 15%
                                            </span>
                                        </ToggleGroupItem>
                                        <ToggleGroupItem
                                            value="custom"
                                            className="h-auto flex-1 flex-col gap-0 py-2"
                                        >
                                            <span className="font-medium">
                                                Custom
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                atur manual
                                            </span>
                                        </ToggleGroupItem>
                                    </ToggleGroup>
                                </Field>

                                {data.tenor_choice === 'custom' && (
                                    <>
                                        <Field
                                            label="Jangka (hari)"
                                            htmlFor="days"
                                        >
                                            <Input
                                                id="days"
                                                type="number"
                                                min={1}
                                                className="no-spinner tabular-nums"
                                                value={data.custom_days}
                                                onChange={(e) =>
                                                    setData(
                                                        'custom_days',
                                                        parseInt(
                                                            e.target.value,
                                                            10,
                                                        ) || 0,
                                                    )
                                                }
                                            />
                                        </Field>
                                        <Field
                                            label="Biaya titipan"
                                            hint={
                                                data.fee_mode === 'nominal'
                                                    ? `Setara ${calc.percent}% dari dana titipan`
                                                    : `Setara ${formatRupiah(calc.fee)}`
                                            }
                                        >
                                            <div className="flex flex-col gap-2">
                                                <ToggleGroup
                                                    type="single"
                                                    variant="outline"
                                                    value={data.fee_mode}
                                                    onValueChange={(v) =>
                                                        v &&
                                                        setData(
                                                            'fee_mode',
                                                            v as
                                                                | 'percent'
                                                                | 'nominal',
                                                        )
                                                    }
                                                    className="w-full"
                                                >
                                                    <ToggleGroupItem
                                                        value="nominal"
                                                        className="flex-1"
                                                    >
                                                        Nominal (Rp)
                                                    </ToggleGroupItem>
                                                    <ToggleGroupItem
                                                        value="percent"
                                                        className="flex-1"
                                                    >
                                                        Persen (%)
                                                    </ToggleGroupItem>
                                                </ToggleGroup>

                                                {data.fee_mode === 'nominal' ? (
                                                    <div className="relative">
                                                        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                                                            Rp
                                                        </span>
                                                        <Input
                                                            id="custom-fee"
                                                            inputMode="numeric"
                                                            value={
                                                                data.custom_fee
                                                                    ? data.custom_fee.toLocaleString(
                                                                          'id-ID',
                                                                      )
                                                                    : ''
                                                            }
                                                            onChange={(e) =>
                                                                setData(
                                                                    'custom_fee',
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
                                                ) : (
                                                    <div className="relative">
                                                        <Input
                                                            id="percent"
                                                            type="number"
                                                            min={0}
                                                            className="no-spinner pr-8 tabular-nums"
                                                            value={
                                                                data.custom_percent
                                                            }
                                                            onChange={(e) =>
                                                                setData(
                                                                    'custom_percent',
                                                                    parseInt(
                                                                        e.target
                                                                            .value,
                                                                        10,
                                                                    ) || 0,
                                                                )
                                                            }
                                                        />
                                                        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                                                            %
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </Field>
                                    </>
                                )}

                                <Field
                                    label="Tanggal masuk"
                                    htmlFor="masuk"
                                >
                                    <DatePicker
                                        id="masuk"
                                        value={data.start_date}
                                        onChange={(v) =>
                                            setData('start_date', v)
                                        }
                                    />
                                </Field>
                                <Field
                                    label="Petugas"
                                    htmlFor="petugas"
                                    hint={
                                        errors.clerk ??
                                        (petugasOptions.length === 0
                                            ? 'Belum ada petugas. Tambahkan di Pengaturan > Kelola Petugas.'
                                            : 'Petugas yang menangani transaksi')
                                    }
                                >
                                    <Select
                                        value={data.clerk}
                                        onValueChange={(v) =>
                                            setData('clerk', v)
                                        }
                                    >
                                        <SelectTrigger
                                            id="petugas"
                                            className="w-full"
                                        >
                                            <SelectValue placeholder="Pilih petugas" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {petugasOptions.map((p) => (
                                                <SelectItem key={p} value={p}>
                                                    {p}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <Field
                                    label="Rak"
                                    htmlFor="rak"
                                    hint={
                                        rakList.length === 0
                                            ? 'Belum ada rak. Tambahkan di menu Rak.'
                                            : 'Rak fisik tempat HP disimpan'
                                    }
                                >
                                    <Select
                                        value={data.rak_id}
                                        onValueChange={(v) =>
                                            setData('rak_id', v)
                                        }
                                    >
                                        <SelectTrigger
                                            id="rak"
                                            className="w-full"
                                        >
                                            <SelectValue placeholder="Pilih rak" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">
                                                Belum ditentukan
                                            </SelectItem>
                                            {rakList.map((r) => (
                                                <SelectItem
                                                    key={r.id}
                                                    value={String(r.id)}
                                                >
                                                    {r.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <Field
                                    label="Catatan"
                                    htmlFor="catatan"
                                    className="sm:col-span-2"
                                >
                                    <Textarea
                                        id="catatan"
                                        value={data.notes}
                                        onChange={(e) =>
                                            setData('notes', e.target.value)
                                        }
                                        placeholder="Keterangan tambahan, kondisi barang, dll."
                                        rows={2}
                                    />
                                </Field>
                            </div>
                        </SectionCard>
                    </div>

                    {/* Right: live summary */}
                    <div className="lg:col-span-1">
                        <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm lg:sticky lg:top-6">
                            <div className="flex items-center gap-2">
                                <CalendarClock className="size-4 text-primary" />
                                <h2 className="font-semibold">Ringkasan</h2>
                            </div>

                            <dl className="space-y-3 text-sm">
                                <div className="border-b pb-3">
                                    <SummaryRow
                                        label="Pelanggan"
                                        value={
                                            customerName ||
                                            (data.customer_mode === 'new'
                                                ? 'Pelanggan baru'
                                                : '—')
                                        }
                                    />
                                </div>
                                <SummaryRow
                                    label="Dana titipan"
                                    value={formatRupiah(data.principal)}
                                />
                                <SummaryRow
                                    label={`Biaya titipan (${calc.percent}%)`}
                                    value={formatRupiah(calc.fee)}
                                    valueClass="text-primary"
                                />
                                <div className="border-t pt-3">
                                    <SummaryRow
                                        label="Total tebus"
                                        value={formatRupiah(calc.total)}
                                        emphasize
                                    />
                                </div>
                                <SummaryRow
                                    label="Jangka waktu"
                                    value={`${calc.tenorDays} hari`}
                                />
                                <SummaryRow
                                    label="Jatuh tempo"
                                    value={formatDate(calc.dueDate)}
                                />
                                {isEdit ? (
                                    <div className="flex items-baseline justify-between gap-3">
                                        <dt className="text-muted-foreground">
                                            Status
                                        </dt>
                                        <dd>
                                            <StatusBadge
                                                status={data.status}
                                                size="sm"
                                            />
                                        </dd>
                                    </div>
                                ) : (
                                    <SummaryRow
                                        label="Petugas"
                                        value={data.clerk || '—'}
                                    />
                                )}
                            </dl>

                            <p className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                                <Info className="mt-0.5 size-3.5 shrink-0" />
                                Biaya titipan terhitung otomatis. Pelanggan
                                menebus dengan membayar total tebus di atas.
                            </p>

                            {!isEdit &&
                                !isManagement &&
                                data.principal > approvalThreshold && (
                                    <p className="flex items-start gap-2 rounded-lg border border-overdue/30 bg-overdue-soft/40 p-3 text-xs text-overdue">
                                        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                                        Pinjaman di atas{' '}
                                        {formatRupiah(approvalThreshold)} perlu
                                        persetujuan Pemilik sebelum dana
                                        dicairkan.
                                    </p>
                                )}

                            <div className="flex flex-col gap-2">
                                {isEdit ? (
                                    <Button
                                        type="submit"
                                        disabled={
                                            processing ||
                                            data.principal <= 0 ||
                                            !data.clerk.trim()
                                        }
                                    >
                                        <Save />
                                        Simpan Perubahan
                                    </Button>
                                ) : (
                                    <>
                                        <Button
                                            type="button"
                                            onClick={(e) => submit(e, true)}
                                            disabled={
                                                processing ||
                                                data.principal <= 0 ||
                                                !data.clerk.trim()
                                            }
                                        >
                                            <Printer />
                                            Simpan & Cetak Nota
                                        </Button>
                                        <Button
                                            type="submit"
                                            variant="outline"
                                            disabled={
                                                processing ||
                                                data.principal <= 0 ||
                                                !data.clerk.trim()
                                            }
                                        >
                                            <Save />
                                            Simpan Saja
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </>
    );
}

type ImeiMatch = {
    code: string;
    customer: string;
    device: string;
    date: string;
    status: GadaiStatus;
};

/**
 * IMEI input that live-checks (debounced) whether the same IMEI was pawned
 * before, and shows a soft warning listing the prior transactions. The current
 * transaction is excluded in edit mode. It only warns — it never blocks.
 */
function ImeiField({
    id,
    label,
    value,
    onChange,
    excludeCode,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    excludeCode?: string | null;
}) {
    const [matches, setMatches] = useState<ImeiMatch[]>([]);

    useEffect(() => {
        const imei = value.trim();
        const controller = new AbortController();

        const timer = setTimeout(() => {
            if (imei.length < 6) {
                setMatches([]);

                return;
            }

            const params = new URLSearchParams({ imei });

            if (excludeCode) {
                params.set('exclude', excludeCode);
            }

            fetch(`/gadai/cek-imei?${params.toString()}`, {
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            })
                .then((r) => (r.ok ? r.json() : []))
                .then((data: ImeiMatch[]) => setMatches(data))
                .catch(() => {
                    // Ignore aborts and network errors — this is only a hint.
                });
        }, 350);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [value, excludeCode]);

    return (
        <Field label={label} htmlFor={id}>
            <Input
                id={id}
                inputMode="numeric"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="15 digit IMEI"
                className={cn(
                    matches.length > 0 &&
                        'border-overdue ring-1 ring-overdue/30',
                )}
            />
            {matches.length > 0 && (
                <div className="mt-1.5 rounded-lg border border-overdue/30 bg-overdue-soft/40 p-2.5 text-xs">
                    <p className="flex items-center gap-1.5 font-medium text-overdue">
                        <AlertTriangle className="size-3.5 shrink-0" />
                        IMEI ini pernah digadaikan
                    </p>
                    <ul className="mt-1 space-y-0.5 text-muted-foreground">
                        {matches.map((m) => (
                            <li key={m.code}>
                                <span className="font-medium text-foreground tabular-nums">
                                    {m.code}
                                </span>{' '}
                                · {m.customer} · {m.device} ·{' '}
                                {formatDate(m.date)} ·{' '}
                                {STATUS_META[m.status].label}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </Field>
    );
}

function Field({
    label,
    htmlFor,
    children,
    hint,
    className,
}: {
    label: string;
    htmlFor?: string;
    children: ReactNode;
    hint?: string;
    className?: string;
}) {
    return (
        <div className={cn('grid gap-1.5', className)}>
            <Label htmlFor={htmlFor}>{label}</Label>
            {children}
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}

function SectionCard({
    icon: Icon,
    title,
    description,
    children,
}: {
    icon: typeof User;
    title: string;
    description?: string;
    children: ReactNode;
}) {
    return (
        <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-foreground/80">
                    <Icon className="size-4.5" />
                </span>
                <div>
                    <h2 className="font-semibold">{title}</h2>
                    {description && (
                        <p className="text-xs text-muted-foreground">
                            {description}
                        </p>
                    )}
                </div>
            </div>
            {children}
        </section>
    );
}

function SelectedCustomerCard({
    customer,
    onChange,
}: {
    customer: Customer;
    onChange: () => void;
}) {
    return (
        <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground/80">
                {initials(customer.name)}
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{customer.name}</span>
                    <span className="rounded-full bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground tabular-nums ring-1 ring-border ring-inset">
                        {customer.id}
                    </span>
                </div>
                <div className="mt-1 grid gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-2">
                    <span className="tabular-nums">{customer.phone}</span>
                    <span className="tabular-nums">
                        KTP: {customer.idNumber}
                    </span>
                    <span className="sm:col-span-2">{customer.address}</span>
                </div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={onChange}>
                Ganti
            </Button>
        </div>
    );
}

function CustomerHistory({
    customer,
    currentId,
}: {
    customer: Customer;
    currentId?: string | null;
}) {
    const history = (customer.transactions ?? []).filter(
        (t) => t.id !== currentId,
    );

    return (
        <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2">
                <History className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Riwayat transaksi</h3>
                {history.length > 0 && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                        {history.length}
                    </span>
                )}
            </div>
            {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    Belum ada transaksi sebelumnya untuk pelanggan ini.
                </p>
            ) : (
                <ul className="flex max-h-56 flex-col divide-y overflow-y-auto">
                    {history.map((t) => (
                        <li
                            key={t.id}
                            className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
                        >
                            <StatusBadge status={t.status} size="sm" />
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline gap-x-2">
                                    <Link
                                        href={t.detailUrl}
                                        className="font-medium tabular-nums hover:text-primary hover:underline"
                                    >
                                        {t.id}
                                    </Link>
                                    <span className="truncate text-xs text-muted-foreground">
                                        {t.device}
                                    </span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {formatDate(t.date)}
                                </div>
                            </div>
                            <span className="shrink-0 text-sm font-medium tabular-nums">
                                {formatRupiah(t.principal)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function SummaryRow({
    label,
    value,
    valueClass,
    emphasize,
}: {
    label: string;
    value: string;
    valueClass?: string;
    emphasize?: boolean;
}) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <dt
                className={cn(
                    'text-muted-foreground',
                    emphasize && 'font-medium text-foreground',
                )}
            >
                {label}
            </dt>
            <dd
                className={cn(
                    'tabular-nums',
                    emphasize
                        ? 'text-lg font-semibold text-foreground'
                        : 'font-medium',
                    valueClass,
                )}
            >
                {value}
            </dd>
        </div>
    );
}
