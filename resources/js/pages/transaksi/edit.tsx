import { GadaiForm } from '@/components/gadai/gadai-form';
import type { RakOption } from '@/components/gadai/gadai-form';
import type { Customer, Transaction } from '@/types/gadai';

export default function GadaiEdit({
    transaction,
    customers,
    petugasList,
    rakList,
}: {
    transaction: Transaction;
    customers: Customer[];
    petugasList: string[];
    rakList: RakOption[];
}) {
    return (
        <GadaiForm
            mode="edit"
            transaction={transaction}
            customers={customers}
            petugasList={petugasList}
            rakList={rakList}
        />
    );
}

GadaiEdit.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Transaksi', href: '/transaksi' },
        { title: 'Edit', href: '/transaksi' },
    ],
};
