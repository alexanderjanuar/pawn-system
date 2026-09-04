import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowRight,
    Check,
    ChevronDown,
    History,
    Pencil,
    PlusCircle,
    Search,
    Send,
    ShieldAlert,
    Trash2,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/gadai/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Activity, ActivityAction } from '@/types/gadai';

const ACTION_META: Record<ActivityAction, { icon: LucideIcon; tone: string }> =
    {
        created: { icon: PlusCircle, tone: 'text-diambil bg-diambil-soft' },
        updated: { icon: Pencil, tone: 'text-aktif bg-aktif-soft' },
        deleted: { icon: Trash2, tone: 'text-lelang bg-lelang-soft' },
    };

const SUBJECT_NOUN: Record<Activity['subjectType'], string> = {
    transaction: 'Transaksi',
    customer: 'Pelanggan',
    petugas: 'Petugas',
    user: 'Akun',
    store: 'Toko',
    rak: 'Rak',
    piutang: 'Piutang',
};

/** Sentinel for "no filter" — Radix Select cannot hold an empty string value. */
const ANY = '__semua__';

type Filters = {
    q: string;
    actor: string;
    category: string;
    flagged: boolean;
};

type Category = { key: string; label: string };

type PageProps = {
    activities: Activity[];
    filters: Filters;
    actors: string[];
    categories: Category[];
    total: number;
    limit: number;
};

function subjectHref(a: Activity): string | null {
    if (a.action === 'deleted' || !a.subjectCode) {
        return null;
    }

    if (a.subjectType === 'transaction') {
        return `/transaksi/${a.subjectCode}`;
    }

    if (a.subjectType === 'customer') {
        return `/pelanggan/${a.subjectCode}`;
    }

    // Petugas roster entries and login accounts have no dedicated detail page.
    return null;
}

/** A burst of this many identical sends collapses into one summary row. */
const BUNDLE_MIN = 3;

type Entry =
    | { kind: 'one'; activity: Activity }
    | { kind: 'bundle'; id: number; items: Activity[] };

/**
 * Actions normally fired in bulk, where one summary row beats a wall of
 * identical entries. Deliberately narrow: creating or editing a transaction is
 * never hidden behind a summary.
 */
function isBurstable(a: Activity): boolean {
    return (
        a.category === 'whatsapp' || a.description.startsWith('Memindahkan rak')
    );
}

/**
 * Collapse a run of back-to-back bulk actions by the same person into a single
 * summary row, so a reminder blast or a whole-rack move cannot bury the
 * transactions around it. Entries arrive newest-first and stay in that order.
 */
function bundleBursts(items: Activity[]): Entry[] {
    const entries: Entry[] = [];
    let i = 0;

    while (i < items.length) {
        const first = items[i];
        let end = i + 1;

        if (isBurstable(first)) {
            while (
                end < items.length &&
                items[end].actor === first.actor &&
                items[end].description === first.description
            ) {
                end += 1;
            }
        }

        const run = items.slice(i, end);

        if (run.length >= BUNDLE_MIN) {
            entries.push({ kind: 'bundle', id: first.id, items: run });
        } else {
            for (const activity of run) {
                entries.push({ kind: 'one', activity });
            }
        }

        i = end;
    }

    return entries;
}

export default function Aktivitas({
    activities,
    filters,
    actors,
    categories,
    total,
    limit,
}: PageProps) {
    const [query, setQuery] = useState(filters.q);

    const categoryLabels = useMemo(
        () => new Map(categories.map((c) => [c.key, c.label])),
        [categories],
    );

    const active =
        filters.q !== '' ||
        filters.actor !== '' ||
        filters.category !== '' ||
        filters.flagged;

    // Filtering runs on the server so search reaches the whole history, not
    // just the page currently loaded.
    const go = (next: Partial<Filters>) => {
        const merged = { ...filters, ...next };
        const params: Record<string, string> = {};

        if (merged.q !== '') {
            params.q = merged.q;
        }

        if (merged.actor !== '') {
            params.actor = merged.actor;
        }

        if (merged.category !== '') {
            params.category = merged.category;
        }

        if (merged.flagged) {
            params.flagged = '1';
        }

        router.get('/aktivitas', params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ['activities', 'filters', 'total'],
        });
    };

    // Wait for a pause in typing before hitting the server.
    useEffect(() => {
        if (query === filters.q) {
            return;
        }

        const timer = setTimeout(() => go({ q: query }), 350);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query]);

    // Preserve incoming (newest-first) order while grouping by day.
    const groups: { date: string; items: Activity[] }[] = [];

    for (const a of activities) {
        const last = groups[groups.length - 1];

        if (last && last.date === a.date) {
            last.items.push(a);
        } else {
            groups.push({ date: a.date, items: [a] });
        }
    }

    return (
        <>
            <Head title="Aktivitas" />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <PageHeader
                    title="Riwayat Aktivitas"
                    description="Jejak audit setiap transaksi dan pelanggan: siapa membuat, mengubah, atau menghapus data, beserta waktunya."
                />

                {/* Filters */}
                <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Cari kode transaksi, nama pelanggan, atau keterangan…"
                            className="pl-9"
                        />
                    </div>
                    <Select
                        value={filters.actor || ANY}
                        onValueChange={(v) => go({ actor: v === ANY ? '' : v })}
                    >
                        <SelectTrigger className="sm:w-48">
                            <SelectValue placeholder="Semua petugas" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ANY}>Semua petugas</SelectItem>
                            {actors.map((a) => (
                                <SelectItem key={a} value={a}>
                                    {a}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={filters.category || ANY}
                        onValueChange={(v) =>
                            go({ category: v === ANY ? '' : v })
                        }
                    >
                        <SelectTrigger className="sm:w-56">
                            <SelectValue placeholder="Semua jenis aksi" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ANY}>
                                Semua jenis aksi
                            </SelectItem>
                            {categories.map((c) => (
                                <SelectItem key={c.key} value={c.key}>
                                    {c.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        variant={filters.flagged ? 'default' : 'outline'}
                        onClick={() => go({ flagged: !filters.flagged })}
                    >
                        <ShieldAlert />
                        Perlu diperiksa
                    </Button>
                    {active && (
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setQuery('');
                                go({
                                    q: '',
                                    actor: '',
                                    category: '',
                                    flagged: false,
                                });
                            }}
                        >
                            <X />
                            Reset
                        </Button>
                    )}
                </div>

                {activities.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                        {total > limit ? (
                            <>
                                Menampilkan{' '}
                                <span className="font-medium text-foreground tabular-nums">
                                    {limit}
                                </span>{' '}
                                terbaru dari{' '}
                                <span className="font-medium text-foreground tabular-nums">
                                    {total.toLocaleString('id-ID')}
                                </span>{' '}
                                aktivitas. Persempit dengan filter di atas.
                            </>
                        ) : (
                            <>
                                <span className="font-medium text-foreground tabular-nums">
                                    {total.toLocaleString('id-ID')}
                                </span>{' '}
                                aktivitas
                                {active ? ' cocok dengan filter' : ''}.
                            </>
                        )}
                    </p>
                )}

                {groups.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card p-12 text-center">
                        <History className="size-8 text-muted-foreground" />
                        <p className="font-medium">
                            {active
                                ? 'Tidak ada aktivitas yang cocok'
                                : 'Belum ada aktivitas'}
                        </p>
                        <p className="max-w-sm text-sm text-muted-foreground">
                            {active
                                ? 'Coba ubah kata kunci, petugas, atau jenis aksinya.'
                                : 'Setiap kali data dibuat, diubah, atau dihapus, catatannya akan muncul di sini.'}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        {groups.map((group) => (
                            <section key={group.date}>
                                <div className="sticky top-0 z-10 -mx-1 mb-3 bg-background/80 px-1 py-1 backdrop-blur">
                                    <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                        {formatDate(group.date)}
                                    </h2>
                                </div>
                                <ol className="overflow-hidden rounded-xl border bg-card shadow-sm">
                                    {bundleBursts(group.items).map(
                                        (entry, i, all) =>
                                            entry.kind === 'bundle' ? (
                                                <BundleRow
                                                    key={`b-${entry.id}`}
                                                    items={entry.items}
                                                    last={i === all.length - 1}
                                                />
                                            ) : (
                                                <ActivityRow
                                                    key={entry.activity.id}
                                                    activity={entry.activity}
                                                    categoryLabel={
                                                        entry.activity.category
                                                            ? (categoryLabels.get(
                                                                  entry.activity
                                                                      .category,
                                                              ) ?? null)
                                                            : null
                                                    }
                                                    last={i === all.length - 1}
                                                />
                                            ),
                                    )}
                                </ol>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

function BundleRow({ items, last }: { items: Activity[]; last: boolean }) {
    const [open, setOpen] = useState(false);
    const first = items[0];
    // Items arrive newest-first, so the run started with the last one.
    const started = items[items.length - 1].time;
    const ended = first.time;

    return (
        <li className={cn('p-4 sm:p-5', !last && 'border-b')}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex w-full gap-3 text-left sm:gap-4"
            >
                <span className="w-10 shrink-0 pt-0.5 text-xs font-medium text-muted-foreground tabular-nums sm:w-12 sm:text-sm">
                    {started === ended ? ended : `${started}–${ended}`}
                </span>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-aktif-soft text-aktif">
                    <Send className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-sm">
                        <span className="font-semibold">{first.actor}</span>{' '}
                        <span className="text-muted-foreground">
                            {first.description.toLowerCase()}
                            {first.category === 'whatsapp' ? ' ke ' : ' untuk '}
                            <span className="font-medium text-foreground tabular-nums">
                                {items.length}
                            </span>
                            {first.category === 'whatsapp'
                                ? ' pelanggan'
                                : ' transaksi'}
                        </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {open ? 'Tutup rincian' : 'Lihat rincian'}
                    </p>
                </div>
                <ChevronDown
                    className={cn(
                        'size-5 shrink-0 text-muted-foreground transition-transform',
                        open && 'rotate-180',
                    )}
                />
            </button>

            {open && (
                <ul className="mt-3 ml-13 flex flex-col gap-1 border-l pl-4 sm:ml-16">
                    {items.map((a) => (
                        <li
                            key={a.id}
                            className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground"
                        >
                            <span className="tabular-nums">{a.time}</span>
                            {a.subjectCode &&
                                (subjectHref(a) ? (
                                    <Link
                                        href={subjectHref(a) as string}
                                        className="font-medium text-foreground tabular-nums hover:text-primary hover:underline"
                                    >
                                        {a.subjectCode}
                                    </Link>
                                ) : (
                                    <span className="font-medium text-foreground tabular-nums">
                                        {a.subjectCode}
                                    </span>
                                ))}
                            {a.subjectLabel && <span>· {a.subjectLabel}</span>}
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
}

function ActivityRow({
    activity: a,
    categoryLabel,
    last,
}: {
    activity: Activity;
    categoryLabel: string | null;
    last: boolean;
}) {
    const meta = ACTION_META[a.action];
    const Icon = meta.icon;
    const href = subjectHref(a);
    const subjectNoun = SUBJECT_NOUN[a.subjectType];

    return (
        <li
            className={cn(
                'flex gap-3 p-4 sm:gap-4 sm:p-5',
                !last && 'border-b',
            )}
        >
            <span className="w-10 shrink-0 pt-0.5 text-xs font-medium text-muted-foreground tabular-nums sm:w-12 sm:text-sm">
                {a.time}
            </span>
            <span
                className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full',
                    meta.tone,
                )}
            >
                <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                    <p className="text-sm">
                        <span className="font-semibold">{a.actor}</span>{' '}
                        <span className="text-muted-foreground">
                            {a.description.toLowerCase()}
                        </span>
                    </p>
                    {a.flagged && !a.reviewedAt && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() =>
                                router.post(
                                    `/aktivitas/${a.id}/tinjau`,
                                    {},
                                    { preserveScroll: true },
                                )
                            }
                        >
                            <Check />
                            Sudah diperiksa
                        </Button>
                    )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>{subjectNoun}</span>
                    {a.subjectCode &&
                        (href ? (
                            <Link
                                href={href}
                                className="font-medium text-foreground tabular-nums hover:text-primary hover:underline"
                            >
                                {a.subjectCode}
                            </Link>
                        ) : (
                            <span
                                className={cn(
                                    'font-medium text-foreground tabular-nums',
                                    a.action === 'deleted' && 'line-through',
                                )}
                            >
                                {a.subjectCode}
                            </span>
                        ))}
                    {a.subjectLabel && (
                        <span className="truncate">· {a.subjectLabel}</span>
                    )}
                    {categoryLabel && (
                        <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                            {categoryLabel}
                        </span>
                    )}
                    {a.flagged && !a.reviewedAt && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-lelang-soft px-2 py-0.5 font-medium text-lelang">
                            <ShieldAlert className="size-3" />
                            Perlu diperiksa
                        </span>
                    )}
                    {a.flagged && a.reviewedAt && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-diambil-soft px-2 py-0.5 font-medium text-diambil">
                            <Check className="size-3" />
                            Diperiksa {a.reviewedBy}
                        </span>
                    )}
                </div>

                {a.changes.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1">
                        {a.changes.map((c, i) => (
                            <li
                                key={i}
                                className="flex flex-wrap items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1 text-xs"
                            >
                                <span className="font-medium">{c.field}</span>
                                <span className="text-muted-foreground line-through">
                                    {c.from || '—'}
                                </span>
                                <ArrowRight className="size-3 text-muted-foreground" />
                                <span className="font-medium text-foreground">
                                    {c.to || '—'}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </li>
    );
}

Aktivitas.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Aktivitas', href: '/aktivitas' },
    ],
};
