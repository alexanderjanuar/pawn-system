import {
    AlertTriangle,
    CheckCircle2,
    CircleDot,
    Gavel,
    RefreshCw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { GadaiStatus } from '@/types/gadai';

type StatusMeta = {
    label: string;
    /** badge: soft tinted bg + strong same-hue text */
    badge: string;
    /** hairline same-hue ring for badge definition */
    ring: string;
    /** solid dot / indicator color */
    dot: string;
    /** strong text-only color (for figures, icons) */
    text: string;
    icon: LucideIcon;
    /** true when the item is closed and no longer "running" */
    terminal: boolean;
};

export const STATUS_META: Record<GadaiStatus, StatusMeta> = {
    AKTIF: {
        label: 'Aktif',
        badge: 'bg-aktif-soft text-aktif',
        ring: 'ring-aktif/25',
        dot: 'bg-aktif',
        text: 'text-aktif',
        icon: CircleDot,
        terminal: false,
    },
    PERPANJANG: {
        label: 'Perpanjang',
        badge: 'bg-perpanjang-soft text-perpanjang',
        ring: 'ring-perpanjang/25',
        dot: 'bg-perpanjang',
        text: 'text-perpanjang',
        icon: RefreshCw,
        terminal: false,
    },
    DIAMBIL: {
        label: 'Diambil',
        badge: 'bg-diambil-soft text-diambil',
        ring: 'ring-diambil/25',
        dot: 'bg-diambil',
        text: 'text-diambil',
        icon: CheckCircle2,
        terminal: true,
    },
    TIDAK_DIAMBIL: {
        label: 'Tidak Diambil',
        badge: 'bg-overdue-soft text-overdue',
        ring: 'ring-overdue/25',
        dot: 'bg-overdue',
        text: 'text-overdue',
        icon: AlertTriangle,
        terminal: false,
    },
    LELANG: {
        label: 'Lelang',
        badge: 'bg-lelang-soft text-lelang',
        ring: 'ring-lelang/25',
        dot: 'bg-lelang',
        text: 'text-lelang',
        icon: Gavel,
        terminal: true,
    },
};

/** Common reasons for blacklisting a customer (free text also allowed). */
export const BLACKLIST_REASONS = [
    'Sering telat',
    'Bermasalah',
    'Identitas palsu',
];

/** Suggested labels for barang photos (optional; a label can repeat). */
export const PHOTO_LABELS = [
    'Depan',
    'Belakang',
    'IMEI',
    'Kondisi LCD',
    'Kelengkapan',
    'Aksesori',
];

/** Display order for filters, tabs, and legends. */
export const STATUS_ORDER: GadaiStatus[] = [
    'AKTIF',
    'PERPANJANG',
    'TIDAK_DIAMBIL',
    'DIAMBIL',
    'LELANG',
];

/** Fee rule defaults from the spec: 15d = 10%, 30d = 15%. */
export function defaultPercentForTenor(tenorDays: number): number | null {
    if (tenorDays === 15) {
        return 10;
    }

    if (tenorDays === 30) {
        return 15;
    }

    return null; // custom
}

/** Biaya titipan = principal × percent. Rounded to whole rupiah. */
export function computeFee(principal: number, percent: number): number {
    return Math.round((principal * percent) / 100);
}

/** Total tebus = dana titipan + biaya titipan. */
export function redeemTotal(principal: number, fee: number): number {
    return principal + fee;
}
