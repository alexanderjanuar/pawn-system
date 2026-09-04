/**
 * Formatting + date helpers for the pawn system.
 * TODAY drives relative labels like "15 hari lagi" and overdue checks. It
 * defaults to the device date but is overridden with the server date (WITA)
 * shared on every page, so an incorrect device clock cannot skew due dates.
 */

export let TODAY = (() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return now;
})();

/**
 * Override TODAY with the authoritative server date (YYYY-MM-DD, WITA). Called
 * from the app shell on every page using the shared `serverDate` prop.
 */
export function setServerToday(iso?: string | null): void {
    if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        TODAY = new Date(`${iso}T00:00:00`);
    }
}

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

/**
 * Readable Indonesian phone number, e.g. "0812-3344-5566". Numbers are stored
 * as plain digits in one canonical shape, so the grouping is display-only.
 */
export function formatPhone(raw: string | null | undefined): string {
    if (!raw) {
        return '';
    }

    let digits = raw.replace(/\D+/g, '');

    if (!digits) {
        return '';
    }

    if (digits.startsWith('62')) {
        digits = `0${digits.slice(2)}`;
    } else if (digits.startsWith('8')) {
        digits = `0${digits}`;
    }

    if (!digits.startsWith('0') || digits.length < 9) {
        return digits;
    }

    return [digits.slice(0, 4), digits.slice(4, 8), digits.slice(8)]
        .filter(Boolean)
        .join('-');
}
