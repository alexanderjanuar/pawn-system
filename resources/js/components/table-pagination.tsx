import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { PAGE_SIZE_OPTIONS } from '@/hooks/use-pagination';
import type { PageSize } from '@/hooks/use-pagination';

/**
 * Shared table footer: "Menampilkan X–Y dari Z", a page-size selector
 * (10 / 20 / 50 / Semua), and Prev/Next controls.
 */
export function TablePagination({
    page,
    totalPages,
    pageSize,
    total,
    from,
    to,
    onPageChange,
    onPageSizeChange,
}: {
    page: number;
    totalPages: number;
    pageSize: PageSize;
    total: number;
    from: number;
    to: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: PageSize) => void;
}) {
    if (total === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="text-muted-foreground">
                    Menampilkan{' '}
                    <span className="text-foreground tabular-nums">
                        {from}–{to}
                    </span>{' '}
                    dari{' '}
                    <span className="text-foreground tabular-nums">
                        {total}
                    </span>
                </p>
                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">
                        Tampilkan
                    </span>
                    <Select
                        value={String(pageSize)}
                        onValueChange={(v) =>
                            onPageSizeChange(v === 'all' ? 'all' : Number(v))
                        }
                    >
                        <SelectTrigger
                            size="sm"
                            className="w-[5.5rem]"
                            aria-label="Jumlah baris per halaman"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PAGE_SIZE_OPTIONS.map((option) => (
                                <SelectItem key={option} value={String(option)}>
                                    {option === 'all' ? 'Semua' : option}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center gap-1">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => onPageChange(page - 1)}
                    >
                        <ChevronLeft />
                        Sebelumnya
                    </Button>
                    <span className="px-2 text-xs text-muted-foreground tabular-nums">
                        Hal {page}/{totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => onPageChange(page + 1)}
                    >
                        Berikutnya
                        <ChevronRight />
                    </Button>
                </div>
            )}
        </div>
    );
}
