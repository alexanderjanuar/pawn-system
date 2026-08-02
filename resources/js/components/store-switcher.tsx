import { router, usePage } from '@inertiajs/react';
import { Check, ChevronsUpDown, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Store switcher for management users. Petugas never see it (their branch is
 * fixed). "Semua Toko" clears the filter for an overview across every store.
 */
export function StoreSwitcher() {
    const page = usePage().props;
    const { stores, activeStore, activeStoreName } = page;

    if (!stores || stores.length === 0) {
        return null;
    }

    const select = (store: number | 'all') => {
        if (store === activeStore) {
            return;
        }

        router.post('/toko/switch', { store }, { preserveScroll: true });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Store className="size-4" />
                    <span className="max-w-[9rem] truncate">
                        {activeStoreName ?? 'Semua Toko'}
                    </span>
                    <ChevronsUpDown className="size-3.5 text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Toko aktif</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => select('all')}>
                    <span className="flex-1">Semua Toko</span>
                    {activeStore === 'all' && <Check className="size-4" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {stores.map((s) => (
                    <DropdownMenuItem key={s.id} onSelect={() => select(s.id)}>
                        <span className="flex-1 truncate">{s.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                            {s.code}
                        </span>
                        {activeStore === s.id && <Check className="size-4" />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
