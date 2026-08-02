<?php

namespace App\Http\Controllers;

use App\Http\Resources\TransactionResource;
use App\Models\Transaction;
use Illuminate\Http\Request;
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
        ]);
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
     * @return \Illuminate\Database\Eloquent\Collection<int, Transaction>
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
        // Demo reference date: matches the sidebar overdue badge & frontend TODAY.
        $ref = Carbon::parse('2026-07-19');

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
}
