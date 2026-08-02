import { STATUS_ORDER } from '@/lib/gadai';
import { countByStatus } from '@/lib/selectors';
import type { GadaiStatus, Transaction } from '@/types/gadai';

export type StatusRow = {
    status: GadaiStatus;
    count: number;
    principal: number;
};

export type ClerkRow = {
    clerk: string;
    count: number;
    dana: number;
    biaya: number;
};

export type Report = {
    total: number;
    danaTersalurkan: number;
    runningPrincipal: number;
    pemasukanBiaya: number;
    avgPrincipal: number;
    ditebus: number;
    lelang: number;
    perStatus: StatusRow[];
    clerks: ClerkRow[];
};

/** Compute report figures over an already period-filtered transaction set. */
export function buildReport(txs: Transaction[]): Report {
    const danaTersalurkan = txs.reduce((s, t) => s + t.principal, 0);

    // Total holding fee (biaya titipan) charged on the period's transactions.
    const pemasukanBiaya = txs.reduce((s, t) => s + t.fee, 0);

    const counts = countByStatus(txs);

    const perStatus: StatusRow[] = STATUS_ORDER.map((status) => ({
        status,
        count: counts[status],
        principal: txs
            .filter((t) => t.status === status)
            .reduce((s, t) => s + t.principal, 0),
    }));

    const clerkNames = [...new Set(txs.map((t) => t.clerk))].sort();
    const clerks: ClerkRow[] = clerkNames.map((clerk) => {
        const rows = txs.filter((t) => t.clerk === clerk);

        return {
            clerk,
            count: rows.length,
            dana: rows.reduce((s, t) => s + t.principal, 0),
            biaya: rows.reduce((s, t) => s + t.fee, 0),
        };
    });

    const runningPrincipal = txs
        .filter((t) => t.status === 'AKTIF' || t.status === 'PERPANJANG')
        .reduce((s, t) => s + t.principal, 0);

    return {
        total: txs.length,
        danaTersalurkan,
        runningPrincipal,
        pemasukanBiaya,
        avgPrincipal: txs.length ? Math.round(danaTersalurkan / txs.length) : 0,
        ditebus: counts.DIAMBIL,
        lelang: counts.LELANG,
        perStatus,
        clerks,
    };
}
