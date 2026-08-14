import type { CashFlow, CashKind } from '@/components/gadai/cash-flow-panel';
import { formatRupiah } from '@/lib/format';

const KIND_LABEL: Record<CashKind, string> = {
    tebus: 'Tebus',
    perpanjang: 'Perpanjang',
    lelang: 'Lelang',
    pencairan: 'Pencairan',
};

const METHOD_LABEL: Record<'cash' | 'transfer', string> = {
    cash: 'Tunai',
    transfer: 'Transfer',
};

/**
 * Daily cash report as a WhatsApp-friendly message (bold via *asterisks*),
 * mirroring the shop's manual cash book: Masuk, Keluar, Saldo, Uang Akhir.
 */
export function buildKasReport(
    cashFlow: CashFlow,
    dateLabel: string,
    shopName: string,
    saldoAwal: number | null,
): string {
    const masuk = cashFlow.entries.filter((e) => e.direction === 'in');
    const keluar = cashFlow.entries.filter((e) => e.direction === 'out');
    const lines: string[] = [];

    lines.push(`*KAS HARIAN · ${shopName}*`);
    lines.push(dateLabel);
    lines.push('');

    lines.push('*MASUK*');

    if (masuk.length > 0) {
        for (const e of masuk) {
            const method = e.method ? ` (${METHOD_LABEL[e.method]})` : '';
            lines.push(
                `• ${e.customer} — ${KIND_LABEL[e.kind]}${method} — ${formatRupiah(e.amount)}`,
            );
        }
    } else {
        lines.push('• (tidak ada)');
    }

    lines.push(`Total Masuk: *${formatRupiah(cashFlow.in.total)}*`);
    lines.push(
        `Tunai ${formatRupiah(cashFlow.in.cash)} · Transfer ${formatRupiah(cashFlow.in.transfer)}`,
    );
    lines.push('');

    lines.push('*KELUAR*');

    if (keluar.length > 0) {
        for (const e of keluar) {
            lines.push(
                `• ${e.customer} — ${KIND_LABEL[e.kind]} — ${formatRupiah(e.amount)}`,
            );
        }
    } else {
        lines.push('• (tidak ada)');
    }

    lines.push(`Total Keluar: *${formatRupiah(cashFlow.out.total)}*`);
    lines.push('');

    if (saldoAwal !== null) {
        lines.push(`Saldo Awal: ${formatRupiah(saldoAwal)}`);
    }

    lines.push(
        `Kas Bersih: ${cashFlow.net >= 0 ? '+' : '−'}${formatRupiah(Math.abs(cashFlow.net))}`,
    );

    if (saldoAwal !== null) {
        lines.push(`*Uang Akhir: ${formatRupiah(saldoAwal + cashFlow.net)}*`);
    }

    return lines.join('\n');
}
