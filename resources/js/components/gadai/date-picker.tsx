import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/** Local YYYY-MM-DD (no timezone shift). */
function toISO(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
    ).padStart(2, '0')}`;
}

/**
 * shadcn Calendar in a Popover, working with plain YYYY-MM-DD strings so it
 * drops straight into the existing string-based filter/form state.
 */
export function DatePicker({
    value,
    onChange,
    id,
    placeholder = 'Pilih tanggal',
    className,
    fromYear = 2024,
    toYear = 2030,
}: {
    value?: string;
    onChange: (value: string) => void;
    id?: string;
    placeholder?: string;
    className?: string;
    fromYear?: number;
    toYear?: number;
}) {
    const [open, setOpen] = React.useState(false);
    const date = value ? new Date(`${value}T00:00:00`) : undefined;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    className={cn(
                        'w-full justify-start gap-2 px-3 font-normal',
                        !date && 'text-muted-foreground',
                        className,
                    )}
                >
                    <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                        {date
                            ? format(date, 'd MMM yyyy', { locale: localeId })
                            : placeholder}
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={date}
                    defaultMonth={date}
                    captionLayout="dropdown"
                    startMonth={new Date(fromYear, 0)}
                    endMonth={new Date(toYear, 11)}
                    locale={localeId}
                    formatters={{
                        formatMonthDropdown: (month) =>
                            month.toLocaleString('id-ID', { month: 'long' }),
                    }}
                    onSelect={(selected) => {
                        onChange(selected ? toISO(selected) : '');
                        setOpen(false);
                    }}
                />
            </PopoverContent>
        </Popover>
    );
}
