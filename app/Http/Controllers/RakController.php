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

        $racks = Rak::query()
            ->with('store')
            ->when($activeId !== null, fn ($query) => $query->where('store_id', $activeId))
            ->orderBy('name')
            ->get();

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
                    'detailUrl' => route('transaksi.show', $t),
                ])->values();

                return [
                    'id' => $rak->id,
                    'name' => $rak->name,
                    'capacity' => $rak->capacity,
                    'active' => $rak->active,
                    'storeName' => $rak->store?->name,
                    'count' => $items->count(),
                    'items' => $items,
                ];
            }),
            'canManage' => $request->user()->isManagement(),
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
