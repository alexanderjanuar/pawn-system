<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Rak;
use App\Models\Store;
use App\Models\Transaction;
use App\Support\ActiveStore;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class RakController extends Controller
{
    public function index(Request $request): Response
    {
        $activeId = app(ActiveStore::class)->id();

        $racks = Rak::sortNaturally(
            Rak::query()
                ->with('store')
                ->when($activeId !== null, fn ($query) => $query->where('store_id', $activeId))
                ->get()
        );

        // Phones currently on each rack (still held), grouped by rak_id.
        $held = Transaction::query()
            ->held()
            ->whereNotNull('rak_id')
            ->with('customer')
            ->when($activeId !== null, fn ($query) => $query->where('store_id', $activeId))
            ->orderByDesc('start_date')
            ->get()
            ->groupBy('rak_id');

        return Inertia::render('rak/index', [
            'racks' => $racks->map(function (Rak $rak) use ($held): array {
                $items = ($held[$rak->id] ?? collect())->map(fn (Transaction $t): array => [
                    'id' => $t->code,
                    'device' => $t->device_name,
                    'customer' => $t->customer->name,
                    'status' => $t->status,
                    'dueDate' => $t->due_date->format('Y-m-d'),
                    'overdue' => $this->isOverdue($t),
                    'detailUrl' => route('transaksi.show', $t),
                ])->values();

                return [
                    'id' => $rak->id,
                    'name' => $rak->name,
                    'capacity' => $rak->capacity,
                    'active' => $rak->active,
                    'storeName' => $rak->store?->name,
                    'count' => $items->count(),
                    'overdueCount' => $items->where('overdue', true)->count(),
                    'items' => $items,
                ];
            }),
            'canManage' => $request->user()->isManagement(),
        ]);
    }

    /**
     * A printable shelf label for one rack, opened in its own tab.
     */
    public function label(Rak $rak): Response
    {
        return Inertia::render('rak/label', [
            'rak' => [
                'name' => $rak->name,
                'capacity' => $rak->capacity,
                'storeName' => $rak->store?->name,
                'count' => $rak->transactions()->held()->count(),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $storeId = $this->resolveStore();

        if ($storeId === false) {
            return back()->with('error', 'Pilih satu toko dari pemilih toko di atas untuk menambah rak.');
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:60', Rule::unique('raks', 'name')->where('store_id', $storeId)],
            'capacity' => ['nullable', 'integer', 'min:1', 'max:999'],
        ]);

        $rak = Rak::create([
            'store_id' => $storeId,
            'name' => $data['name'],
            'capacity' => $data['capacity'] ?? null,
            'active' => true,
        ]);

        ActivityLog::record('created', 'rak', $rak->name, $rak->name, 'Menambah rak');

        return back()->with('success', "Rak {$rak->name} ditambahkan.");
    }

    public function update(Request $request, Rak $rak): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:60', Rule::unique('raks', 'name')->where('store_id', $rak->store_id)->ignore($rak->id)],
            'capacity' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:999'],
            'active' => ['sometimes', 'boolean'],
        ]);

        $rak->update($data);

        ActivityLog::record('updated', 'rak', $rak->name, $rak->name, 'Memperbarui rak');

        return back()->with('success', "Rak {$rak->name} diperbarui.");
    }

    public function destroy(Rak $rak): RedirectResponse
    {
        $held = $rak->transactions()->held()->count();

        if ($held > 0) {
            return back()->with('error', "Rak {$rak->name} masih menyimpan {$held} HP. Pindahkan dulu sebelum menghapus.");
        }

        $name = $rak->name;
        $rak->delete();

        ActivityLog::record('deleted', 'rak', $name, $name, 'Menghapus rak');

        return back()->with('success', "Rak {$name} dihapus.");
    }

    /**
     * Move one held phone (transaction) to another rack, or off the rack.
     * The change is logged so it appears in the transaction's Riwayat & audit.
     */
    public function moveItem(Request $request, Transaction $transaction): RedirectResponse
    {
        $data = $request->validate([
            'rak_id' => ['nullable', 'integer', 'exists:raks,id'],
        ]);

        $targetId = $data['rak_id'] ?? null;
        $targetRak = $targetId ? Rak::find($targetId) : null;

        // A phone can only be moved to a rack in its own store.
        if ($targetRak !== null && $targetRak->store_id !== $transaction->store_id) {
            return back()->with('error', 'Rak tujuan bukan dari toko yang sama.');
        }

        if (($transaction->rak_id ?? null) === $targetId) {
            return back();
        }

        $from = $transaction->rak?->name ?? 'Tanpa rak';
        $to = $targetRak?->name ?? 'Tanpa rak';

        $transaction->update(['rak_id' => $targetId]);

        ActivityLog::record(
            'updated',
            'transaction',
            $transaction->code,
            $transaction->customer->name,
            "Memindahkan rak: {$from} → {$to}",
            [['field' => 'Rak', 'from' => $from, 'to' => $to]],
        );

        return back()->with('success', "{$transaction->device_name} dipindahkan ke {$to}.");
    }

    /**
     * Move every phone currently on one rack to another rack (or off the rack),
     * for when a shelf is being cleared or rearranged. Each phone still gets its
     * own history entry so the audit trail stays complete.
     */
    public function moveAll(Request $request, Rak $rak): RedirectResponse
    {
        $data = $request->validate([
            'rak_id' => ['nullable', 'integer', 'exists:raks,id'],
        ]);

        $targetId = $data['rak_id'] ?? null;

        if ($targetId === $rak->id) {
            return back()->with('error', 'Rak tujuan sama dengan rak asal.');
        }

        $targetRak = $targetId ? Rak::find($targetId) : null;

        if ($targetRak !== null && $targetRak->store_id !== $rak->store_id) {
            return back()->with('error', 'Rak tujuan bukan dari toko yang sama.');
        }

        $items = $rak->transactions()->held()->with('customer')->get();

        if ($items->isEmpty()) {
            return back()->with('error', "Rak {$rak->name} tidak berisi HP.");
        }

        $to = $targetRak?->name ?? 'Tanpa rak';

        foreach ($items as $transaction) {
            $transaction->update(['rak_id' => $targetId]);

            ActivityLog::record(
                'updated',
                'transaction',
                $transaction->code,
                $transaction->customer->name,
                "Memindahkan rak: {$rak->name} → {$to}",
                [['field' => 'Rak', 'from' => $rak->name, 'to' => $to]],
            );
        }

        return back()->with('success', "{$items->count()} HP dipindahkan dari {$rak->name} ke {$to}.");
    }

    /**
     * Due today or already past due, matching the Jatuh Tempo list. A phone
     * already flagged "Tidak Diambil" is a decision taken, not a to-do.
     */
    private function isOverdue(Transaction $transaction): bool
    {
        return in_array($transaction->status, ['AKTIF', 'PERPANJANG'], true)
            && $transaction->due_date->startOfDay()->lte(now()->startOfDay());
    }

    /**
     * The store a new rack belongs to (the active store). Returns false when a
     * management user is viewing "all stores" and must pick one first; null in
     * a single-shop setup with no stores yet.
     */
    private function resolveStore(): int|false|null
    {
        $activeId = app(ActiveStore::class)->id();

        if ($activeId !== null) {
            return $activeId;
        }

        return Store::query()->exists() ? false : null;
    }
}
