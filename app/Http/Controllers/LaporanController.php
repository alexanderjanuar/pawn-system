<?php

namespace App\Http\Controllers;

use App\Http\Resources\TransactionResource;
use App\Models\CashAnchor;
use App\Models\CashEntry;
use App\Models\Transaction;
use App\Models\TransactionEvent;
use App\Models\Wallet;
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

        $cashFlow = $this->cashFlow($from, $to);

        return Inertia::render('kas', [
            'period' => ['from' => $from, 'to' => $to],
            'cashFlow' => $cashFlow,
            'saldoAwal' => $this->saldoAwal($from),
            'walletSummary' => $this->walletSummary($from, $cashFlow),
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
            'wallet_id' => ['nullable', 'integer', 'exists:wallets,id'],
        ]);

        CashAnchor::create([
            'store_id' => app(ActiveStore::class)->id(),
            'wallet_id' => $this->resolveWalletId($data['wallet_id'] ?? null),
            'anchor_date' => $data['date'] ?? now()->toDateString(),
            'amount' => (int) $data['amount'],
            'set_by' => $request->user()?->name,
        ]);

        return back()->with('success', 'Saldo kas diperbarui.');
    }

    /** A chosen active wallet, or the default pocket when none/invalid. */
    private function resolveWalletId(?int $walletId): ?int
    {
        if ($walletId !== null && Wallet::query()->active()->whereKey($walletId)->exists()) {
            return $walletId;
        }

        return Wallet::defaultId();
    }

    /**
     * The physical cash balance at the start of the given day across all
     * pockets. When viewing "all stores" it sums each store's opening balance,
     * so the aggregate is consistent with the (already aggregated) movements.
     * Null when no anchor has been set yet for the scope.
     */
    private function saldoAwal(string $date): ?int
    {
        if ($date === '') {
            return null;
        }

        $saldos = $this->walletSaldos($date);

        return $saldos === [] ? null : (int) array_sum($saldos);
    }

    /**
     * Opening balance per wallet for the active scope, aggregated across every
     * store when no single store is selected ("Semua Toko").
     *
     * @return array<int, int>
     */
    private function walletSaldos(string $date): array
    {
        if ($date === '') {
            return [];
        }

        $saldos = [];

        foreach ($this->saldoStores($date) as $storeId) {
            foreach ($this->anchoredWalletIds($date, $storeId) as $walletId) {
                $saldo = $this->walletSaldoAwal($date, $walletId, $storeId);

                if ($saldo !== null) {
                    $saldos[$walletId] = ($saldos[$walletId] ?? 0) + $saldo;
                }
            }
        }

        return $saldos;
    }

    /**
     * Stores whose opening balances count: the active store, or every store
     * that has an anchor when viewing "all stores".
     *
     * @return array<int, int|null>
     */
    private function saldoStores(string $date): array
    {
        $active = app(ActiveStore::class)->id();

        if ($active !== null) {
            return [$active];
        }

        return CashAnchor::query()
            ->whereDate('anchor_date', '<=', $date)
            ->pluck('store_id')
            ->unique()
            ->values()
            ->all();
    }

    /**
     * One pocket's opening balance for a specific store: its latest anchor on
     * or before the day plus that store+pocket's net cash since. Null if unset.
     */
    private function walletSaldoAwal(string $date, int $walletId, ?int $storeId): ?int
    {
        if ($date === '') {
            return null;
        }

        $anchor = CashAnchor::query()
            ->where('wallet_id', $walletId)
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

        $net = $anchorDate > $dayBefore
            ? 0
            : ($this->storeWalletNet($storeId, $anchorDate, $dayBefore)[$walletId] ?? 0);

        return (int) $anchor->amount + $net;
    }

    /**
     * Wallet ids that have an anchor on or before the day for one store scope.
     *
     * @return array<int, int>
     */
    private function anchoredWalletIds(string $date, ?int $storeId): array
    {
        return CashAnchor::query()
            ->when($storeId === null, fn ($q) => $q->whereNull('store_id'), fn ($q) => $q->where('store_id', $storeId))
            ->whereNotNull('wallet_id')
            ->whereDate('anchor_date', '<=', $date)
            ->distinct()
            ->pluck('wallet_id')
            ->all();
    }

    /**
     * Net cash per wallet for a single store scope over a date range, used to
     * roll a pocket's opening balance forward from its anchor date.
     *
     * @return array<int, int>
     */
    private function storeWalletNet(?int $storeId, string $from, string $to): array
    {
        $defaultWalletId = Wallet::defaultId();
        $net = [];

        $add = function (?int $walletId, string $direction, int $amount) use (&$net, $defaultWalletId) {
            $walletId ??= $defaultWalletId;

            if ($walletId === null) {
                return;
            }

            $net[$walletId] = ($net[$walletId] ?? 0) + ($direction === 'in' ? $amount : -$amount);
        };

        $events = TransactionEvent::query()
            ->with('transaction')
            ->whereHas('transaction', fn ($q) => $storeId === null
                ? $q->whereNull('store_id')
                : $q->where('store_id', $storeId))
            ->whereIn('type', ['created', 'redeemed', 'extended', 'auctioned'])
            ->when($from !== '', fn ($q) => $q->whereDate('event_date', '>=', $from))
            ->when($to !== '', fn ($q) => $q->whereDate('event_date', '<=', $to))
            ->get();

        foreach ($events as $event) {
            $transaction = $event->transaction;

            if ($transaction === null) {
                continue;
            }

            $amount = (int) ($event->amount ?? 0);

            $direction = match ($event->type) {
                'redeemed', 'extended' => 'in',
                'auctioned' => $amount > 0 ? 'in' : null,
                'created' => $transaction->approval_status === 'approved' ? 'out' : null,
                default => null,
            };

            if ($direction === null || $amount <= 0) {
                continue;
            }

            $add($event->wallet_id, $direction, $amount);
        }

        $manual = CashEntry::query()
            ->when($storeId === null, fn ($q) => $q->whereNull('store_id'), fn ($q) => $q->where('store_id', $storeId))
            ->when($from !== '', fn ($q) => $q->whereDate('entry_date', '>=', $from))
            ->when($to !== '', fn ($q) => $q->whereDate('entry_date', '<=', $to))
            ->get();

        foreach ($manual as $entry) {
            $add($entry->wallet_id, $entry->direction, (int) $entry->amount);
        }

        return $net;
    }

    /**
     * Per-pocket balance summary for the Kas page: opening balance, in/out for
     * the period, and the resulting closing balance the drawer should hold.
     *
     * @param  array<string, mixed>  $cashFlow
     * @return array<int, array{id: int, name: string, saldoAwal: int|null, masuk: int, keluar: int, net: int, kasAkhir: int|null}>
     */
    private function walletSummary(string $from, array $cashFlow): array
    {
        $byWallet = $cashFlow['byWallet'];
        $saldos = $this->walletSaldos($from);

        // Every active wallet, plus any wallet that has movement or an opening balance.
        $wallets = Wallet::query()->active()->orderBy('sort')->orderBy('id')->get();
        $ids = $wallets->pluck('id')->all();

        foreach ([...array_keys($byWallet), ...array_keys($saldos)] as $id) {
            if (! in_array($id, $ids, true)) {
                $ids[] = $id;
            }
        }

        $names = Wallet::query()->pluck('name', 'id');
        $summary = [];

        foreach ($ids as $id) {
            $masuk = $byWallet[$id]['in'] ?? 0;
            $keluar = $byWallet[$id]['out'] ?? 0;
            $saldoAwal = $saldos[$id] ?? null;

            $summary[] = [
                'id' => $id,
                'name' => $names[$id] ?? 'Dompet',
                'saldoAwal' => $saldoAwal,
                'masuk' => $masuk,
                'keluar' => $keluar,
                'net' => $masuk - $keluar,
                'kasAkhir' => $saldoAwal !== null ? $saldoAwal + ($masuk - $keluar) : null,
            ];
        }

        return $summary;
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
                'title' => $labels[$cursor->month - 1].' '.$cursor->year,
                'value' => (int) ($byMonth[$key] ?? 0),
                'current' => $cursor->isSameMonth(now()),
                // Lets the report jump straight to this month when its bar is clicked.
                'from' => $cursor->copy()->startOfMonth()->toDateString(),
                'to' => $cursor->copy()->endOfMonth()->toDateString(),
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
     *     byWallet: array<int, array{id: int, in: int, out: int, net: int}>,
     *     entries: array<int, array<string, mixed>>
     * }
     */
    private function cashFlow(string $from, string $to): array
    {
        $defaultWalletId = Wallet::defaultId();
        $walletNames = Wallet::query()->pluck('name', 'id');

        $events = TransactionEvent::query()
            ->with('transaction.customer')
            ->whereHas('transaction', fn ($q) => $q->forActiveStore())
            ->whereIn('type', ['created', 'redeemed', 'extended', 'auctioned'])
            ->when($from !== '', fn ($q) => $q->whereDate('event_date', '>=', $from))
            ->when($to !== '', fn ($q) => $q->whereDate('event_date', '<=', $to))
            ->get();

        $in = ['tebus' => 0, 'perpanjang' => 0, 'lelang' => 0, 'manual' => 0, 'cash' => 0, 'transfer' => 0, 'unset' => 0, 'total' => 0];
        $out = ['pencairan' => 0, 'manual' => 0, 'total' => 0];
        $byWallet = [];
        $entries = [];

        $addIn = function (int $amount, ?string $method, string $kind) use (&$in) {
            $in[$kind] += $amount;
            $in['total'] += $amount;
            $bucket = in_array($method, ['cash', 'transfer'], true) ? $method : 'unset';
            $in[$bucket] += $amount;
        };

        $addWallet = function (?int $walletId, string $direction, int $amount) use (&$byWallet, $defaultWalletId) {
            $walletId ??= $defaultWalletId;

            if ($walletId === null) {
                return;
            }

            $byWallet[$walletId] ??= ['id' => $walletId, 'in' => 0, 'out' => 0, 'net' => 0];
            $byWallet[$walletId][$direction] += $amount;
            $byWallet[$walletId]['net'] += $direction === 'in' ? $amount : -$amount;
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

            // Totals count the full amount once.
            if ($direction === 'in') {
                $addIn($amount, $event->payment_method, $kind);
            } else {
                $out[$kind] += $amount;
                $out['total'] += $amount;
            }

            // A disbursement may be funded from several pockets; each portion is
            // a separate wallet movement and a separate table row.
            $allocations = is_array($event->wallet_split) && $event->wallet_split !== []
                ? $event->wallet_split
                : [['wallet_id' => $event->wallet_id ?? $defaultWalletId, 'amount' => $amount]];

            foreach ($allocations as $allocation) {
                $walletId = $allocation['wallet_id'] ?? $defaultWalletId;
                $portion = (int) ($allocation['amount'] ?? 0);

                if ($portion <= 0) {
                    continue;
                }

                $addWallet($walletId, $direction, $portion);

                $entries[] = [
                    'id' => $event->id,
                    'source' => 'event',
                    'code' => $transaction->code,
                    'customer' => $transaction->customer?->name ?? '—',
                    'kind' => $kind,
                    'direction' => $direction,
                    'amount' => $portion,
                    'method' => $event->payment_method,
                    'walletId' => $walletId,
                    'walletName' => $walletId !== null ? ($walletNames[$walletId] ?? null) : null,
                    'date' => $event->event_date->format('Y-m-d'),
                    'time' => $event->created_at?->format('H.i'),
                    'clerk' => $event->by ?: $transaction->clerk,
                ];
            }
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

            $walletId = $entry->wallet_id ?? $defaultWalletId;
            $addWallet($walletId, $entry->direction, $amount);

            $entries[] = [
                'id' => $entry->id,
                'source' => 'manual',
                'code' => null,
                'customer' => $entry->description,
                'kind' => 'manual',
                'direction' => $entry->direction,
                'amount' => $amount,
                'method' => $entry->method,
                'walletId' => $walletId,
                'walletName' => $walletId !== null ? ($walletNames[$walletId] ?? null) : null,
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
            'byWallet' => $byWallet,
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
            'wallet_id' => ['nullable', 'integer', 'exists:wallets,id'],
        ]);

        CashEntry::create([
            'store_id' => app(ActiveStore::class)->id(),
            'entry_date' => $data['date'] ?? now()->toDateString(),
            'direction' => $data['direction'],
            'amount' => (int) $data['amount'],
            'description' => $data['description'],
            'method' => $data['method'] ?? 'cash',
            'by' => $request->user()?->name,
            'wallet_id' => $this->resolveWalletId($data['wallet_id'] ?? null),
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
