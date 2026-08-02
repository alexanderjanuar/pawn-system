import type { GadaiStatus, Transaction } from '@/types/gadai';

/** Pure selectors over a transactions array (data now comes from the server). */

export function getTransaction(
    txs: Transaction[],
    id: string,
): Transaction | undefined {
    return txs.find((t) => t.id === id);
}

export function countByStatus(txs: Transaction[]): Record<GadaiStatus, number> {
    const counts: Record<GadaiStatus, number> = {
        AKTIF: 0,
        PERPANJANG: 0,
        DIAMBIL: 0,
        TIDAK_DIAMBIL: 0,
        LELANG: 0,
    };

    for (const t of txs) {
        counts[t.status] += 1;
    }

    return counts;
}

/** Items still "running" (money on the street): AKTIF + PERPANJANG. */
export function runningTransactions(txs: Transaction[]): Transaction[] {
    return txs.filter((t) => t.status === 'AKTIF' || t.status === 'PERPANJANG');
}

/** A customer's transactions (matched by phone), newest first. */
export function customerTransactions(
    txs: Transaction[],
    phone: string,
): Transaction[] {
    return txs
        .filter((t) => t.customer.phone === phone)
        .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export type CustomerStats = {
    total: number;
    active: number;
    runningPrincipal: number;
    feePaid: number;
    lastActivity: string | null;
};

/** Stats for a customer, given that customer's transactions. */
export function customerStats(txs: Transaction[]): CustomerStats {
    const running = runningTransactions(txs);
    const feePaid =
        txs
            .filter((t) => t.status === 'DIAMBIL')
            .reduce((sum, t) => sum + t.fee, 0) +
        txs
            .flatMap((t) => t.history)
            .filter((e) => e.type === 'extended')
            .reduce((sum, e) => sum + (e.amount ?? 0), 0);

    return {
        total: txs.length,
        active: running.length,
        runningPrincipal: running.reduce((sum, t) => sum + t.principal, 0),
        feePaid,
        lastActivity: txs.length > 0 ? txs[0].startDate : null,
    };
}
