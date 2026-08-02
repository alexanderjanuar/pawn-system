import { DatePicker } from '@/components/gadai/date-picker';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { DATE_PRESETS, detectPreset, presetRange } from '@/lib/date-presets';
import type { PresetKey } from '@/lib/date-presets';

/**
 * Period filter: quick presets (Hari ini, Minggu ini, Bulan ini, …) plus
 * Dari/Sampai calendars for a custom range. Works with YYYY-MM-DD strings.
 */
export function DateRangeFilter({
    from,
    to,
    onChange,
    idPrefix = 'periode',
}: {
    from: string;
    to: string;
    onChange: (from: string, to: string) => void;
    idPrefix?: string;
}) {
    const active = detectPreset(from, to);

    return (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end sm:gap-2">
            <div className="col-span-2 grid gap-1 sm:col-span-1">
                <Label
                    htmlFor={`${idPrefix}-preset`}
                    className="text-xs text-muted-foreground"
                >
                    Periode
                </Label>
                <Select
                    value={active}
                    onValueChange={(key) => {
                        if (key === 'custom') {
                            return;
                        }

                        const range = presetRange(key as PresetKey);
                        onChange(range.from, range.to);
                    }}
                >
                    <SelectTrigger
                        id={`${idPrefix}-preset`}
                        className="w-full sm:w-40"
                    >
                        <SelectValue placeholder="Pilih periode" />
                    </SelectTrigger>
                    <SelectContent>
                        {DATE_PRESETS.map((preset) => (
                            <SelectItem key={preset.key} value={preset.key}>
                                {preset.label}
                            </SelectItem>
                        ))}
                        {active === 'custom' && (
                            <>
                                <SelectSeparator />
                                <SelectItem value="custom">Custom</SelectItem>
                            </>
                        )}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid gap-1">
                <Label
                    htmlFor={`${idPrefix}-dari`}
                    className="text-xs text-muted-foreground"
                >
                    Dari
                </Label>
                <DatePicker
                    id={`${idPrefix}-dari`}
                    value={from}
                    onChange={(value) => onChange(value, to)}
                    className="sm:w-40"
                />
            </div>

            <div className="grid gap-1">
                <Label
                    htmlFor={`${idPrefix}-sampai`}
                    className="text-xs text-muted-foreground"
                >
                    Sampai
                </Label>
                <DatePicker
                    id={`${idPrefix}-sampai`}
                    value={to}
                    onChange={(value) => onChange(from, value)}
                    className="sm:w-40"
                />
            </div>
        </div>
    );
}
