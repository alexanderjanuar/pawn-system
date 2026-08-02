import { GadaiForm } from '@/components/gadai/gadai-form';
import type { Customer } from '@/types/gadai';

export default function GadaiCreate({
    customers,
    petugasList,
    rakList,
    suggestedCode,
    notaPrefix,
    today,
}: {
    customers: Customer[];
    petugasList: string[];
    rakList: { id: number; name: string }[];
    suggestedCode: string;
    notaPrefix: string;
    today: string;
}) {
    return (
        <GadaiForm
            mode="create"
            customers={customers}
            petugasList={petugasList}
            rakList={rakList}
            suggestedCode={suggestedCode}
            notaPrefix={notaPrefix}
            today={today}
        />
    );
}

GadaiCreate.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Transaksi', href: '/transaksi' },
        { title: 'Gadai Baru', href: '/gadai/baru' },
    ],
};
