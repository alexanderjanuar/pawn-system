import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Says out loud why a save button will not work yet.
 *
 * Greying out a button without a reason leaves the clerk clicking a dead
 * control and guessing which box is empty, so the missing fields are named
 * before the click rather than after it.
 */
export function MissingFields({
    fields,
    note,
}: {
    /** Human labels of the required fields still empty, in form order. */
    fields: string[];
    /** Extra blocker that is not an empty field, e.g. a split that doesn't add up. */
    note?: string | null;
}) {
    if (fields.length === 0 && !note) {
        return null;
    }

    return (
        <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-overdue/30 bg-overdue-soft/40 px-3 py-2.5 text-xs"
        >
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-overdue" />
            <div className="min-w-0">
                {fields.length > 0 && (
                    <p className="text-muted-foreground">
                        Belum bisa disimpan. Lengkapi dulu:{' '}
                        {fields.map((field, i) => (
                            <span key={field}>
                                <span className="font-semibold text-foreground">
                                    {field}
                                </span>
                                {i < fields.length - 1 ? ', ' : '.'}
                            </span>
                        ))}
                    </p>
                )}
                {note && (
                    <p
                        className={cn(
                            'text-muted-foreground',
                            fields.length > 0 && 'mt-1',
                        )}
                    >
                        {note}
                    </p>
                )}
            </div>
        </div>
    );
}
