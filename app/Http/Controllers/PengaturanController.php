<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Clerk;
use App\Models\Setting;
use App\Models\Store;
use App\Models\Transaction;
use App\Support\ActiveStore;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PengaturanController extends Controller
{
    public function biaya(): Response
    {
        return Inertia::render('pengaturan/biaya', [
            'approvalThreshold' => (int) Setting::get(
                'approval_threshold',
                Transaction::APPROVAL_THRESHOLD,
            ),
        ]);
    }

    public function updateBiaya(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'approval_threshold' => ['required', 'integer', 'min:0'],
        ]);

        Setting::put('approval_threshold', $data['approval_threshold']);

        return back()->with('success', 'Ambang persetujuan pencairan disimpan.');
    }

    public function petugas(): Response
    {
        $activeId = app(ActiveStore::class)->id();

        // Transaction counts keyed by "store_id|clerk" (names repeat per store).
        $counts = Transaction::query()
            ->whereNotNull('clerk')
            ->selectRaw('store_id, clerk, COUNT(*) as total')
            ->groupBy('store_id', 'clerk')
            ->get()
            ->keyBy(fn (Transaction $t): string => $t->store_id.'|'.$t->clerk)
            ->map(fn (Transaction $t): int => (int) $t->total);

        return Inertia::render('pengaturan/petugas', [
            'petugas' => Clerk::query()
                ->with('store')
                ->when($activeId !== null, fn ($query) => $query->where('store_id', $activeId))
                ->orderByDesc('active')
                ->orderBy('name')
                ->get()
                ->map(fn (Clerk $clerk): array => [
                    'id' => $clerk->id,
                    'name' => $clerk->name,
                    'active' => $clerk->active,
                    'storeName' => $clerk->store?->name,
                    'transactionCount' => (int) ($counts[$clerk->store_id.'|'.$clerk->name] ?? 0),
                ]),
        ]);
    }

    public function storePetugas(Request $request): RedirectResponse
    {
        $storeId = $this->resolveStore();

        if ($storeId === false) {
            return back()->with('error', 'Pilih satu toko dari pemilih toko di atas untuk menambah petugas.');
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('clerks', 'name')->where('store_id', $storeId)],
        ]);

        $clerk = Clerk::create(['store_id' => $storeId, 'name' => $data['name'], 'active' => true]);

        ActivityLog::record('created', 'petugas', $clerk->name, $clerk->name, 'Menambah petugas');

        return back()->with('success', "Petugas {$clerk->name} ditambahkan.");
    }

    public function updatePetugas(Request $request, Clerk $clerk): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120', Rule::unique('clerks', 'name')->where('store_id', $clerk->store_id)->ignore($clerk->id)],
            'active' => ['sometimes', 'boolean'],
        ]);

        $clerk->update($data);

        $message = match (true) {
            array_key_exists('active', $data) && ! array_key_exists('name', $data) => $clerk->active
                ? "Petugas {$clerk->name} diaktifkan."
                : "Petugas {$clerk->name} dinonaktifkan.",
            default => "Petugas {$clerk->name} diperbarui.",
        };

        ActivityLog::record('updated', 'petugas', $clerk->name, $clerk->name, $message);

        return back()->with('success', $message);
    }

    public function showPetugas(Clerk $clerk): Response
    {
        $txs = Transaction::query()
            ->with('customer')
            ->where('clerk', $clerk->name)
            ->where('store_id', $clerk->store_id)
            ->orderByDesc('start_date')
            ->get();

        $total = $txs->count();
        $totalPrincipal = (int) $txs->sum('principal');
        $totalFee = (int) $txs->sum('fee');
        $running = $txs->whereIn('status', ['AKTIF', 'PERPANJANG'])->count();

        $byStatus = collect(['AKTIF', 'PERPANJANG', 'TIDAK_DIAMBIL', 'DIAMBIL', 'LELANG'])
            ->map(fn (string $status): array => [
                'status' => $status,
                'count' => $txs->where('status', $status)->count(),
                'principal' => (int) $txs->where('status', $status)->sum('principal'),
            ])
            ->filter(fn (array $row): bool => $row['count'] > 0)
            ->values();

        return Inertia::render('pengaturan/petugas-detail', [
            'petugas' => [
                'id' => $clerk->id,
                'name' => $clerk->name,
                'active' => $clerk->active,
            ],
            'stats' => [
                'total' => $total,
                'totalPrincipal' => $totalPrincipal,
                'totalFee' => $totalFee,
                'running' => $running,
                'avgPrincipal' => $total > 0 ? intdiv($totalPrincipal, $total) : 0,
                'firstDate' => $txs->isNotEmpty() ? $txs->last()->start_date->format('Y-m-d') : null,
                'lastDate' => $txs->isNotEmpty() ? $txs->first()->start_date->format('Y-m-d') : null,
            ],
            'byStatus' => $byStatus,
            'monthly' => $this->clerkMonthly($txs),
            'transactions' => $txs->map(fn (Transaction $t): array => [
                'id' => $t->code,
                'date' => $t->start_date->format('Y-m-d'),
                'dueDate' => $t->due_date->format('Y-m-d'),
                'customer' => $t->customer->name,
                'device' => $t->device_name,
                'principal' => (int) $t->principal,
                'fee' => (int) $t->fee,
                'status' => $t->status,
                'detailUrl' => route('transaksi.show', $t),
            ]),
        ]);
    }

    public function showPetugasByName(string $name): RedirectResponse
    {
        $activeId = app(ActiveStore::class)->id();

        // Names can repeat across stores; prefer a match in the active store.
        $clerk = Clerk::query()
            ->where('name', $name)
            ->when($activeId !== null, fn ($query) => $query->where('store_id', $activeId))
            ->first()
            ?? Clerk::query()->where('name', $name)->first();

        if (! $clerk) {
            return redirect()
                ->route('pengaturan.petugas')
                ->with('error', "Petugas \"{$name}\" tidak ada di daftar.");
        }

        return redirect()->route('pengaturan.petugas.show', $clerk);
    }

    /**
     * The store a new petugas belongs to (the active store). Returns false when
     * a management user is viewing "all stores" and must pick one first; null
     * in a single-shop setup with no stores yet.
     */
    private function resolveStore(): int|false|null
    {
        $activeId = app(ActiveStore::class)->id();

        if ($activeId !== null) {
            return $activeId;
        }

        return Store::query()->exists() ? false : null;
    }

    public function destroyPetugas(Clerk $clerk): RedirectResponse
    {
        $name = $clerk->name;
        $clerk->delete();

        ActivityLog::record('deleted', 'petugas', $name, $name, 'Menghapus petugas');

        return redirect()
            ->route('pengaturan.petugas')
            ->with('success', "Petugas {$name} dihapus.");
    }

    /**
     * Disbursed loan principal per month over the last 6 months, for the
     * petugas detail chart. Mirrors the report trend format.
     *
     * @param  \Illuminate\Support\Collection<int, Transaction>  $txs
     * @return array<int, array{label: string, value: int, current: bool}>
     */
    private function clerkMonthly($txs): array
    {
        $byMonth = [];

        foreach ($txs as $t) {
            $key = $t->start_date->format('Y-m');
            $byMonth[$key] = ($byMonth[$key] ?? 0) + (int) $t->principal;
        }

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
}
