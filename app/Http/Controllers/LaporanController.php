<?php

namespace App\Http\Controllers;

use App\Http\Resources\TransactionResource;
use App\Models\Transaction;
use App\Models\TransactionEvent;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
            'cashFlow' => $this->cashFlow($from, $to),
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
        ]);
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
     * Holding-fee (biaya titipan) charged per month, by loan start date, over
     * the last 6 months (all data). Bucketed in PHP to stay DB-agnostic.
     *
     * @return array<int, array{label: string, value: int, current: bool}>
     */
    private function feeTrend(): array
    {
        $byMonth = [];

        Transaction::query()
            ->forActiveStore()
            ->where('approval_status', '!=', 'rejected')
            ->get(['fee', 'start_date', 'store_id'])
            ->each(function (Transaction $t) use (&$byMonth) {
                $key = $t->start_date->format('Y-m');
                $byMonth[$key] = ($byMonth[$key] ?? 0) + $t->fee;
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
     *     in: array{tebus: int, perpanjang: int, lelang: int, cash: int, transfer: int, unset: int, total: int},
     *     out: array{pencairan: int, total: int},
     *     net: int,
     *     entries: array<int, array{id: int, code: string, customer: string, kind: string, direction: string, amount: int, method: string|null, date: string, time: string|null, clerk: string}>
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
            ->orderByDesc('event_date')
            ->orderByDesc('id')
            ->get();

        $in = ['tebus' => 0, 'perpanjang' => 0, 'lelang' => 0, 'cash' => 0, 'transfer' => 0, 'unset' => 0, 'total' => 0];
        $out = ['pencairan' => 0, 'total' => 0];
        $entries = [];

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
                $in[$kind] += $amount;
                $in['total'] += $amount;

                $bucket = in_array($event->payment_method, ['cash', 'transfer'], true)
                    ? $event->payment_method
                    : 'unset';
                $in[$bucket] += $amount;
            } else {
                $out[$kind] += $amount;
                $out['total'] += $amount;
            }

            $entries[] = [
                'id' => $event->id,
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

        return [
            'in' => $in,
            'out' => $out,
            'net' => $in['total'] - $out['total'],
            'entries' => $entries,
        ];
    }
}
