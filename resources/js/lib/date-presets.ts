import {
    endOfMonth,
    endOfWeek,
    startOfMonth,
    startOfWeek,
    subDays,
    subMonths,
} from 'date-fns';
import { TODAY } from '@/lib/format';

/** Local YYYY-MM-DD (no timezone shift). */
function iso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
    ).padStart(2, '0')}`;
}

export type PresetKey =
    | 'all'
    | 'today'
    | 'yesterday'
    | 'last7'
    | 'thisWeek'
    | 'thisMonth'
    | 'lastMonth'
    | 'last30';

export type DateRange = { from: string; to: string };

export const DATE_PRESETS: { key: PresetKey; label: string }[] = [
    { key: 'all', label: 'Semua tanggal' },
    { key: 'today', label: 'Hari ini' },
    { key: 'yesterday', label: 'Kemarin' },
    { key: 'last7', label: '7 hari terakhir' },
    { key: 'thisWeek', label: 'Minggu ini' },
    { key: 'thisMonth', label: 'Bulan ini' },
    { key: 'lastMonth', label: 'Bulan lalu' },
    { key: 'last30', label: '30 hari terakhir' },
];

/** Range for a preset, relative to the app's TODAY. Week starts Monday. */
export function presetRange(key: PresetKey): DateRange {
    const t = TODAY;

    switch (key) {
        case 'today':
            return { from: iso(t), to: iso(t) };
        case 'yesterday': {
            const y = subDays(t, 1);

            return { from: iso(y), to: iso(y) };
        }
        case 'last7':
            return { from: iso(subDays(t, 6)), to: iso(t) };
        case 'last30':
            return { from: iso(subDays(t, 29)), to: iso(t) };
        case 'thisWeek':
            return {
                from: iso(startOfWeek(t, { weekStartsOn: 1 })),
                to: iso(endOfWeek(t, { weekStartsOn: 1 })),
            };
        case 'thisMonth':
            return { from: iso(startOfMonth(t)), to: iso(endOfMonth(t)) };
        case 'lastMonth': {
            const lm = subMonths(t, 1);

            return { from: iso(startOfMonth(lm)), to: iso(endOfMonth(lm)) };
        }
        case 'all':
        default:
            return { from: '', to: '' };
    }
}

/** Which preset (if any) the current from/to matches; otherwise 'custom'. */
export function detectPreset(from: string, to: string): PresetKey | 'custom' {
    for (const preset of DATE_PRESETS) {
        const range = presetRange(preset.key);

        if (range.from === from && range.to === to) {
            return preset.key;
        }
    }

    return 'custom';
}
