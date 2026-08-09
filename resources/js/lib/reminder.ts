import { daysUntil, formatDate, formatRupiah } from '@/lib/format';
import type { Transaction } from '@/types/gadai';

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
