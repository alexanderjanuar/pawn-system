/**
 * Formatting + date helpers for the pawn system.
 * TODAY is the real current date (at local midnight) so relative labels like
 * "15 hari lagi" and overdue counts reflect the actual day.
 */

export const TODAY = (() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return now;
})();

const rupiah = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
});

/** "Rp 1.500.000" */
export function formatRupiah(value: number): string {
    // Intl renders "Rp1.500.000" — add the conventional space after the symbol.
    return rupiah.format(value).replace(/^Rp\s?/, 'Rp ');
}

/** Compact rupiah for tight spots like chart labels: "3,5 jt", "350 rb". */
export function formatCompactRupiah(value: number): string {
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
    }

    if (value >= 1_000) {
        return `${Math.round(value / 1_000)} rb`;
    }

    return String(value);
}

/** "12 Jul 2026" */
export function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

/** "Sabtu, 12 Juli 2026" */
export function formatDateLong(iso: string): string {
    return new Date(iso).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

/** Whole days from TODAY to the given date. Negative = already past. */
export function daysUntil(iso: string): number {
    const target = new Date(iso);
    target.setHours(0, 0, 0, 0);
    const ms = target.getTime() - TODAY.getTime();

    return Math.round(ms / 86_400_000);
}

/** Human due-date phrasing relative to TODAY. */
export function dueLabel(iso: string): string {
    const d = daysUntil(iso);

    if (d === 0) {
        return 'Jatuh tempo hari ini';
    }

    if (d === 1) {
        return 'Jatuh tempo besok';
    }

    if (d > 1) {
        return `${d} hari lagi`;
    }

    if (d === -1) {
        return 'Lewat 1 hari';
    }

    return `Lewat ${Math.abs(d)} hari`;
}

/** Relative past-day phrasing for activity feeds. */
export function relativeDay(iso: string): string {
    const d = daysUntil(iso);

    if (d === 0) {
        return 'Hari ini';
    }

    if (d === -1) {
        return 'Kemarin';
    }

    if (d < -1) {
        return `${Math.abs(d)} hari lalu`;
    }

    return formatDate(iso);
}

/** Terminal statuses no longer count toward "waktu berjalan". */
export function addDays(iso: string, days: number): string {
    const d = new Date(iso);
    d.setDate(d.getDate() + days);

    return d.toISOString().slice(0, 10);
}
