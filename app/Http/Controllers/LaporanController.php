<?php

namespace App\Http\Controllers;

use App\Http\Resources\TransactionResource;
use App\Models\CashAnchor;
use App\Models\CashEntry;
use App\Models\Transaction;
use App\Models\TransactionEvent;
use App\Support\ActiveStore;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class LaporanController extends Controller
{
    public function index(Request $request): Response
    {
        [$from, $to] = $this->period($request);

        return Inertia::render('laporan', [
            'transactions' => TransactionResource::collection(
                $this->transactions($from, $to),
            ),
            'period' => ['from' => $from, 'to' => $to],
            'trend' => $this->feeTrend(),
            'dailyTrend' => $this->dailyTrend(),
            'overview' => $this->overview(),
            'feeIncome' => $this->feeIncome($from, $to),
        ]);
    }

    /**
     * Daily cash reconciliation, open to petugas (unlike the full report).
     * Defaults to today so a clerk can match the drawer at end of shift.
     */
    public function kas(Request $request): Response
    {
        if ($request->has('from') || $request->has('to')) {
            $from = (string) $request->query('from', '');
            $to = (string) $request->query('to', '');
        } else {
            $from = now()->toDateString();
            $to = now()->toDateString();
        }

        return Inertia::render('kas', [
            'period' => ['from' => $from, 'to' => $to],
            'cashFlow' => $this->cashFlow($from, $to),
            'saldoAwal' => $this->saldoAwal($from),
        ]);
    }

    /**
     * Daily cash as a styled Excel file (HTML-based .xls, no extra package),
     * mirroring the manual cash book: itemised Masuk & Keluar, totals, and a
     * reconciliation block (Saldo Awal, Kas Sistem, Kas Fisik, Selisih).
     */
    public function kasExport(Request $request): HttpResponse
    {
        if ($request->has('from') || $request->has('to')) {
            $from = (string) $request->query('from', '');
            $to = (string) $request->query('to', '');
        } else {
            $from = now()->toDateString();
            $to = now()->toDateString();
        }

        $cashFlow = $this->cashFlow($from, $to);
        $saldo = $this->saldoAwal($from) ?? 0;
        $shop = mb_substr(trim((string) $request->query('shop', '')) ?: 'Gulam Cell', 0, 60);
        $periodLabel = $from === $to
            ? $this->idDate($from)
            : $this->idDate($from).' – '.$this->idDate($to);

        $html = view('exports.kas', [
            'shop' => $shop,
            'periodLabel' => $periodLabel,
            'saldo' => $saldo,
            'masuk' => array_values(array_filter($cashFlow['entries'], fn ($e) => $e['direction'] === 'in')),
            'keluar' => array_values(array_filter($cashFlow['entries'], fn ($e) => $e['direction'] === 'out')),
            'in' => $cashFlow['in'],
            'out' => $cashFlow['out'],
            'net' => $cashFlow['net'],
            'kindLabels' => ['tebus' => 'Tebus', 'perpanjang' => 'Perpanjang', 'lelang' => 'Lelang', 'pencairan' => 'Pencairan', 'manual' => 'Manual'],
            'methodLabels' => ['cash' => 'Tunai', 'transfer' => 'Transfer'],
        ])->render();

        $fileName = 'kas-harian-'.($from ?: 'semua').($from !== $to ? '-'.$to : '').'.xls';

        return response($html, 200, [
            'Content-Type' => 'application/vnd.ms-excel; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$fileName.'"',
        ]);
    }

    /** Format a Y-m-d date in Indonesian short form, e.g. "14 Agu 2026". */
    private function idDate(string $ymd): string
    {
        if ($ymd === '') {
            return '';
        }

        $months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        $date = Carbon::parse($ymd);

        return $date->day.' '.$months[$date->month].' '.$date->year;
    }

    /**
     * Set (or correct, during reconciliation) the physical cash balance. The
     * running balance is computed forward from this checkpoint.
     */
    public function setCashAnchor(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'integer', 'min:0'],
            'date' => ['nullable', 'date'],
        ]);

        CashAnchor::create([
            'store_id' => app(ActiveStore::class)->id(),
            'anchor_date' => $data['date'] ?? now()->toDateString(),
            'amount' => (int) $data['amount'],
            'set_by' => $request->user()?->name,
        ]);

        return back()->with('success', 'Saldo kas diperbarui.');
    }

    /**
     * The physical cash balance at the start of the given day, computed from
     * the latest anchor on or before it plus the net cash since. Null when no
     * anchor has been set yet for the active store.
     */
    private function saldoAwal(string $date): ?int
    {
        if ($date === '') {
            return null;
        }

        $storeId = app(ActiveStore::class)->id();
        $anchor = CashAnchor::query()
            ->when($storeId === null, fn ($q) => $q->whereNull('store_id'), fn ($q) => $q->where('store_id', $storeId))
            ->whereDate('anchor_date', '<=', $date)
            ->orderByDesc('anchor_date')
            ->orderByDesc('id')
            ->first();

        if ($anchor === null) {
            return null;
        }

        $anchorDate = $anchor->anchor_date->toDateString();
        $dayBefore = Carbon::parse($date)->subDay()->toDateString();

        // Net cash for the full days between the anchor and the day in question.
        $net = $anchorDate > $dayBefore
            ? 0
            : $this->cashFlow($anchorDate, $dayBefore)['net'];

        return (int) $anchor->amount + $net;
    }

    /**
     * Change how one cash-in movement was received (cash / transfer), edited
     * inline from the daily-cash table. Only incoming-money events qualify.
     */
    public function updateCashMethod(Request $request, TransactionEvent $event): RedirectResponse
    {
        $data = $request->validate([
            'payment_method' => ['required', 'in:cash,transfer'],
        ]);

        $inStore = Transaction::query()
            ->forActiveStore()
            ->whereKey($event->transaction_id)
            ->exists();

        abort_unless($inStore && in_array($event->type, ['redeemed', 'extended', 'auctioned'], true), 403);

        $event->update(['payment_method' => $data['payment_method']]);

        return back()->with('success', 'Metode pembayaran diperbarui.');
    }

    public function lelang(): Response
    {
        $items = Transaction::with(['customer', 'events'])
            ->forActiveStore()
            ->where('status', 'LELANG')
            ->orderByDesc('start_date')
            ->get();

        return Inertia::render('laporan/lelang', [
            'transactions' => TransactionResource::collection($items),
        ]);
    }

    public function cetak(Request $request): Response
    {
        [$from, $to] = $this->period($request);

        return Inertia::render('laporan/cetak', [
            'transactions' => TransactionResource::collection(
                $this->transactions($from, $to),
            ),
            'period' => ['from' => $from, 'to' => $to],
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        [$from, $to] = $this->period($request);
        $rows = $this->transactions($from, $to);

        $fileName = 'laporan-gadai-'.($from ?: 'semua').'-'.($to ?: 'semua').'.csv';

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // UTF-8 BOM for Excel

            fputcsv($out, [
                'Kode', 'Tanggal Masuk', 'Jatuh Tempo', 'Pelanggan', 'No. HP',
                'Barang', 'Status', 'Dana Titipan', 'Biaya Titipan',
                'Total Tebus', 'Petugas',
            ]);

            foreach ($rows as $t) {
                fputcsv($out, [
                    $t->code,
                    $t->start_date->format('Y-m-d'),
                    $t->due_date->format('Y-m-d'),
                    $t->customer->name,
                    $t->customer->phone,
                    $t->device_name,
                    $t->status,
                    $t->principal,
                    $t->fee,
                    $t->principal + $t->fee,
                    $t->clerk,
                ]);
            }

            fclose($out);
        }, $fileName, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * @return Collection<int, Transaction>
     */
    private function transactions(string $from, string $to)
    {
        return Transaction::with(['customer', 'events'])
            ->forActiveStore()
            ->when($from !== '', fn ($q) => $q->whereDate('start_date', '>=', $from))
            ->when($to !== '', fn ($q) => $q->whereDate('start_date', '<=', $to))
            ->orderByDesc('start_date')
            ->get();
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function period(Request $request): array
    {
        if ($request->has('from') || $request->has('to')) {
            return [
                (string) $request->query('from', ''),
                (string) $request->query('to', ''),
            ];
        }

        return [
            now()->startOfMonth()->toDateString(),
            now()->endOfMonth()->toDateString(),
        ];
    }

    /**
     * Payment events that carry biaya-titipan (interest) actually collected:
     * every extension fee, and the fee portion of every redemption.
     *
     * @return Builder<TransactionEvent>
     */
    private function feeIncomeEvents(): Builder
    {
        return TransactionEvent::query()
            ->whereHas('transaction', fn ($q) => $q->forActiveStore())
            ->whereIn('type', ['extended', 'redeemed']);
    }

    /**
     * Interest earned by one payment event. Extensions are pure interest; a
     * redemption pays principal + interest, so the interest is amount - pokok.
     */
    private function eventInterest(TransactionEvent $event): int
    {
        if ($event->type === 'redeemed') {
            return max(0, (int) ($event->amount ?? 0) - (int) ($event->transaction?->principal ?? 0));
        }

        return (int) ($event->amount ?? 0);
    }

    /**
     * Interest (biaya titipan) actually collected between two dates, counted on
     * the day it was paid and split by source (extension vs redemption), plus
     * the itemised payments behind it. An empty bound means unbounded.
     *
     * @return array{
     *     perpanjang: int, tebus: int, total: int,
     *     entries: array<int, array{id: int, code: string|null, customer: string, kind: string, amount: int, date: string, time: string|null, clerk: string}>
     * }
     */
    private function feeIncome(string $from, string $to): array
    {
        $events = $this->feeIncomeEvents()
            ->with(['transaction:id,customer_id,code,principal,clerk', 'transaction.customer:id,name'])
            ->when($from !== '', fn ($q) => $q->whereDate('event_date', '>=', $from))
            ->when($to !== '', fn ($q) => $q->whereDate('event_date', '<=', $to))
            ->orderByDesc('event_date')
            ->orderByDesc('id')
            ->get();

        $perpanjang = (int) $events->where('type', 'extended')
            ->sum(fn (TransactionEvent $event) => $this->eventInterest($event));
        $tebus = (int) $events->where('type', 'redeemed')
            ->sum(fn (TransactionEvent $event) => $this->eventInterest($event));

        $entries = $events->map(fn (TransactionEvent $event) => [
            'id' => $event->id,
            'code' => $event->transaction?->code,
            'customer' => $event->transaction?->customer?->name ?? '—',
            'kind' => $event->type === 'extended' ? 'perpanjang' : 'tebus',
            'amount' => $this->eventInterest($event),
            'date' => $event->event_date->format('Y-m-d'),
            'time' => $event->created_at?->format('H.i'),
            'clerk' => $event->by ?: ($event->transaction?->clerk ?? '—'),
        ])->all();

        return [
            'perpanjang' => $perpanjang,
            'tebus' => $tebus,
            'total' => $perpanjang + $tebus,
            'entries' => $entries,
        ];
    }

    /**
     * Interest actually collected per month over the last 6 months, by the
     * date each payment was made (so extensions land in the right month).
     *
     * @return array<int, array{label: string, value: int, current: bool}>
     */
    private function feeTrend(): array
    {
        $start = now()->startOfMonth()->subMonths(5);
        $byMonth = [];

        $this->feeIncomeEvents()
            ->with('transaction:id,principal')
            ->whereDate('event_date', '>=', $start->toDateString())
            ->get()
            ->each(function (TransactionEvent $event) use (&$byMonth) {
                $key = $event->event_date->format('Y-m');
                $byMonth[$key] = ($byMonth[$key] ?? 0) + $this->eventInterest($event);
            });

        $labels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        $months = [];
        $cursor = now()->startOfMonth()->subMonths(5);

        for ($i = 0; $i < 6; $i++) {
            $key = $cursor->format('Y-m');
            $months[] = [
                'label' => $labels[$cursor->month - 1],
                'value' => (int) ($byMonth[$key] ?? 0),
                'current' => $cursor->isSameMonth(now()),
            ];
            $cursor = $cursor->addMonth();
        }

        return $months;
    }

    /**
     * Disbursed loan principal per day over the last 14 days (all data).
     *
     * @return array<int, array{label: string, value: int, current: bool}>
     */
    private function dailyTrend(): array
    {
        $byDay = Transaction::query()
            ->forActiveStore()
            ->where('approval_status', 'approved')
            ->selectRaw('DATE(start_date) as d, SUM(principal) as total')
            ->groupBy('d')
            ->pluck('total', 'd');

        $days = [];
        $cursor = now()->startOfDay()->subDays(13);

        for ($i = 0; $i < 14; $i++) {
            $key = $cursor->format('Y-m-d');
            $days[] = [
                'label' => (string) $cursor->day,
                'value' => (int) $byDay->get($key, 0),
                'current' => $cursor->isSameDay(now()),
            ];
            $cursor = $cursor->addDay();
        }

        return $days;
    }

    /**
     * Current business snapshot, independent of the report period.
     *
     * @return array{uangBeredar: int, barangAktif: int, lewatTempo: int, lelang: int}
     */
    private function overview(): array
    {
        // Matches the sidebar overdue badge & frontend TODAY.
        $ref = now();

        return [
            'uangBeredar' => (int) Transaction::query()
                ->forActiveStore()
                ->where('approval_status', 'approved')
                ->whereIn('status', ['AKTIF', 'PERPANJANG'])
                ->sum('principal'),
            'barangAktif' => Transaction::query()
                ->forActiveStore()
                ->where('approval_status', 'approved')
                ->whereIn('status', ['AKTIF', 'PERPANJANG'])
                ->count(),
            'lewatTempo' => Transaction::query()
                ->forActiveStore()
                ->where('approval_status', 'approved')
                ->whereIn('status', ['AKTIF', 'PERPANJANG', 'TIDAK_DIAMBIL'])
                ->whereDate('due_date', '<=', $ref)
                ->count(),
            'lelang' => Transaction::query()->forActiveStore()->where('status', 'LELANG')->count(),
        ];
    }

    /**
     * Cash movements within the period, for reconciling the system against the
     * physical drawer. Money IN: redeem (dana + biaya), extension fee, auction
     * sale. Money OUT: disbursed principal of approved new pawns. Each movement
     * is listed individually so the clerk can tick it off against real cash.
     *
     * @return array{
     *     in: array{tebus: int, perpanjang: int, lelang: int, manual: int, cash: int, transfer: int, unset: int, total: int},
     *     out: array{pencairan: int, manual: int, total: int},
     *     net: int,
     *     entries: array<int, array{id: int, source: string, code: string|null, customer: string, kind: string, direction: string, amount: int, method: string|null, date: string, time: string|null, clerk: string}>
     * }
     */
    private function cashFlow(string $from, string $to): array
    {
        $events = TransactionEvent::query()
            ->with('transaction.customer')
            ->whereHas('transaction', fn ($q) => $q->forActiveStore())
            ->whereIn('type', ['created', 'redeemed', 'extended', 'auctioned'])
            ->when($from !== '', fn ($q) => $q->whereDate('event_date', '>=', $from))
            ->when($to !== '', fn ($q) => $q->whereDate('event_date', '<=', $to))
            ->get();

        $in = ['tebus' => 0, 'perpanjang' => 0, 'lelang' => 0, 'manual' => 0, 'cash' => 0, 'transfer' => 0, 'unset' => 0, 'total' => 0];
        $out = ['pencairan' => 0, 'manual' => 0, 'total' => 0];
        $entries = [];

        $addIn = function (int $amount, ?string $method, string $kind) use (&$in) {
            $in[$kind] += $amount;
            $in['total'] += $amount;
            $bucket = in_array($method, ['cash', 'transfer'], true) ? $method : 'unset';
            $in[$bucket] += $amount;
        };

        foreach ($events as $event) {
            $transaction = $event->transaction;

            if ($transaction === null) {
                continue;
            }

            $amount = (int) ($event->amount ?? 0);

            [$direction, $kind] = match ($event->type) {
                'redeemed' => ['in', 'tebus'],
                'extended' => ['in', 'perpanjang'],
                'auctioned' => $amount > 0 ? ['in', 'lelang'] : [null, null],
                'created' => $transaction->approval_status === 'approved' ? ['out', 'pencairan'] : [null, null],
                default => [null, null],
            };

            if ($direction === null || $amount <= 0) {
                continue;
            }

            if ($direction === 'in') {
                $addIn($amount, $event->payment_method, $kind);
            } else {
                $out[$kind] += $amount;
                $out['total'] += $amount;
            }

            $entries[] = [
                'id' => $event->id,
                'source' => 'event',
                'code' => $transaction->code,
                'customer' => $transaction->customer?->name ?? '—',
                'kind' => $kind,
                'direction' => $direction,
                'amount' => $amount,
                'method' => $event->payment_method,
                'date' => $event->event_date->format('Y-m-d'),
                'time' => $event->created_at?->format('H.i'),
                'clerk' => $event->by ?: $transaction->clerk,
            ];
        }

        // Manual cash entries (operational expenses, top-ups, etc.).
        $storeId = app(ActiveStore::class)->id();
        $manual = CashEntry::query()
            ->when($storeId === null, fn ($q) => $q->whereNull('store_id'), fn ($q) => $q->where('store_id', $storeId))
            ->when($from !== '', fn ($q) => $q->whereDate('entry_date', '>=', $from))
            ->when($to !== '', fn ($q) => $q->whereDate('entry_date', '<=', $to))
            ->get();

        foreach ($manual as $entry) {
            $amount = (int) $entry->amount;

            if ($entry->direction === 'in') {
                $addIn($amount, $entry->method, 'manual');
            } else {
                $out['manual'] += $amount;
                $out['total'] += $amount;
            }

            $entries[] = [
                'id' => $entry->id,
                'source' => 'manual',
                'code' => null,
                'customer' => $entry->description,
                'kind' => 'manual',
                'direction' => $entry->direction,
                'amount' => $amount,
                'method' => $entry->method,
                'date' => $entry->entry_date->format('Y-m-d'),
                'time' => $entry->created_at?->format('H.i'),
                'clerk' => $entry->by ?? '—',
            ];
        }

        // Newest first across both sources.
        usort($entries, fn ($a, $b) => strcmp(
            $b['date'].' '.($b['time'] ?? ''),
            $a['date'].' '.($a['time'] ?? ''),
        ));

        return [
            'in' => $in,
            'out' => $out,
            'net' => $in['total'] - $out['total'],
            'entries' => $entries,
        ];
    }

    /**
     * Record a manual cash movement (e.g. an operational expense) on the daily
     * cash page. It counts toward the reconciliation like any other movement.
     */
    public function storeCashEntry(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'direction' => ['required', 'in:in,out'],
            'amount' => ['required', 'integer', 'min:1'],
            'description' => ['required', 'string', 'max:120'],
            'method' => ['nullable', 'in:cash,transfer'],
            'date' => ['nullable', 'date'],
        ]);

        CashEntry::create([
            'store_id' => app(ActiveStore::class)->id(),
            'entry_date' => $data['date'] ?? now()->toDateString(),
            'direction' => $data['direction'],
            'amount' => (int) $data['amount'],
            'description' => $data['description'],
            'method' => $data['method'] ?? 'cash',
            'by' => $request->user()?->name,
        ]);

        return back()->with('success', 'Kas manual dicatat.');
    }

    /** Remove a manual cash entry (only within the active store). */
    public function destroyCashEntry(CashEntry $cashEntry): RedirectResponse
    {
        $storeId = app(ActiveStore::class)->id();

        abort_unless($cashEntry->store_id === $storeId, 403);

        $cashEntry->delete();

        return back()->with('success', 'Kas manual dihapus.');
    }
}
