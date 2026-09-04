import {
    Check,
    ChevronsUpDown,
    Search,
    ShieldAlert,
    UserPlus,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { formatPhone } from '@/lib/format';
import { initials } from '@/lib/utils';
import type { Customer } from '@/types/gadai';

export function CustomerCombobox({
    customers,
    value,
    onSelect,
    onAddNew,
}: {
    customers: Customer[];
    value: Customer | null;
    onSelect: (customer: Customer) => void;
    onAddNew?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        const list = q
            ? customers.filter((c) =>
                  `${c.name} ${c.phone} ${formatPhone(c.phone)} ${c.id}`
                      .toLowerCase()
                      .includes(q),
              )
            : customers;

        return list.slice(0, 20);
    }, [customers, query]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between gap-2 px-3 font-normal"
                >
                    {value ? (
                        <span className="truncate">
                            {value.name}
                            <span className="text-muted-foreground">
                                {' '}
                                · {formatPhone(value.phone)}
                            </span>
                        </span>
                    ) : (
                        <span className="text-muted-foreground">
                            Cari nama atau nomor HP…
                        </span>
                    )}
                    <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-(--radix-popover-trigger-width) p-0"
                align="start"
            >
                <div className="relative border-b p-2">
                    <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Ketik nama / nomor HP…"
                        className="h-9 pl-9"
                    />
                </div>

                <ul className="max-h-64 overflow-y-auto p-1">
                    {results.length > 0 ? (
                        results.map((c) => (
                            <li key={c.id}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onSelect(c);
                                        setOpen(false);
                                        setQuery('');
                                    }}
                                    className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
                                >
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-foreground/80">
                                        {initials(c.name)}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                                            {c.name}
                                            {c.blacklisted && (
                                                <ShieldAlert className="size-3.5 shrink-0 text-lelang" />
                                            )}
                                        </span>
                                        <span className="block truncate text-xs text-muted-foreground tabular-nums">
                                            {formatPhone(c.phone)} · {c.id}
                                        </span>
                                    </span>
                                    {value?.id === c.id && (
                                        <Check className="size-4 shrink-0 text-primary" />
                                    )}
                                </button>
                            </li>
                        ))
                    ) : (
                        <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                            Pelanggan tidak ditemukan.
                        </li>
                    )}
                </ul>

                {onAddNew && (
                    <div className="border-t p-1">
                        <button
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                setQuery('');
                                onAddNew();
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-primary transition-colors hover:bg-accent"
                        >
                            <UserPlus className="size-4" />
                            Pelanggan baru
                        </button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
