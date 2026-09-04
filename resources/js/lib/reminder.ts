import { daysUntil, formatDate, formatRupiah } from '@/lib/format';
import type { Transaction } from '@/types/gadai';

/** The instalment a debtor owes next, when a termin schedule exists. */
export type NextDue = { seq: number; amount: number; dueDate: string };

/**
 * Default WhatsApp reminder text for a due or overdue pawn loan.
 * `*text*` renders as bold in WhatsApp. The clerk can edit this before sending.
 */
export function buildReminderMessage(tx: Transaction, shopName: string): string {
    const total = tx.principal + tx.fee;
    const d = daysUntil(tx.dueDate);

    const situation =
        d < 0
            ? `*sudah lewat jatuh tempo ${Math.abs(d)} hari*`
            : d === 0
              ? '*jatuh tempo hari ini*'
              : `akan *jatuh tempo dalam ${d} hari*`;

    return [
        `Halo ${tx.customer.name},`,
        '',
        `Kami dari ${shopName} mengingatkan bahwa gadai Anda ${situation}.`,
        '',
        `No. Nota: ${tx.id}`,
        `Barang: ${tx.device.name}`,
        `Jatuh tempo: ${formatDate(tx.dueDate)}`,
        `Total tebus: *${formatRupiah(total)}*`,
        '',
        'Mohon segera melakukan penebusan atau perpanjangan agar barang tidak masuk daftar lelang.',
        '',
        'Terima kasih.',
    ].join('\n');
}

/**
 * Default WhatsApp reminder text for an outstanding piutang (credit purchase).
 * Mentions the next instalment when a termin schedule exists, otherwise just
 * the remaining balance.
 */
export function buildPiutangReminderMessage(
    piutang: {
        code: string;
        debtorName: string;
        deviceName: string;
        remaining: number;
        nextDue: NextDue | null;
    },
    shopName: string,
): string {
    const lines = [
        `Halo ${piutang.debtorName},`,
        '',
        `Kami dari ${shopName} mengingatkan cicilan HP Anda.`,
        '',
        `No. Piutang: ${piutang.code}`,
        `Barang: ${piutang.deviceName}`,
    ];

    if (piutang.nextDue) {
        const d = daysUntil(piutang.nextDue.dueDate);
        const situation =
            d < 0
                ? `*sudah telat ${Math.abs(d)} hari*`
                : d === 0
                  ? '*jatuh tempo hari ini*'
                  : `jatuh tempo dalam *${d} hari*`;

        lines.push(
            `Cicilan ke-${piutang.nextDue.seq}: *${formatRupiah(piutang.nextDue.amount)}*`,
            `Jatuh tempo: ${formatDate(piutang.nextDue.dueDate)} (${situation})`,
        );
    }

    lines.push(
        `Sisa piutang: *${formatRupiah(piutang.remaining)}*`,
        '',
        'Mohon segera melakukan pembayaran. Abaikan pesan ini jika sudah membayar.',
        '',
        'Terima kasih.',
    );

    return lines.join('\n');
}
