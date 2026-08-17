import { formatDate, formatRupiah } from '@/lib/format';
import type { Transaction } from '@/types/gadai';

/**
 * Default WhatsApp caption when sending a customer their nota. The PDF file is
 * attached server-side, so this is just the accompanying message (`*text*`
 * renders bold in WhatsApp). The clerk can edit it before sending.
 */
export function buildNotaMessage(tx: Transaction, shopName: string): string {
    return [
        `Halo ${tx.customer.name},`,
        '',
        `Berikut nota gadai Anda dari ${shopName}.`,
        '',
        `No. Nota: ${tx.id}`,
        `Barang: ${tx.device.name}`,
        `Jatuh tempo: ${formatDate(tx.dueDate)}`,
        `Total tebus: *${formatRupiah(tx.principal + tx.fee)}*`,
        '',
        'Mohon simpan nota ini untuk penebusan atau perpanjangan. Terima kasih.',
    ].join('\n');
}
