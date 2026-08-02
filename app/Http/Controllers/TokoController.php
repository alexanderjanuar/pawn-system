<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Clerk;
use App\Models\Store;
use App\Models\Transaction;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TokoController extends Controller
{
    public function index(): Response
    {
        $txCounts = Transaction::query()
            ->whereNotNull('store_id')
            ->selectRaw('store_id, COUNT(*) as total')
            ->groupBy('store_id')
            ->pluck('total', 'store_id');

        $clerkCounts = Clerk::query()
            ->whereNotNull('store_id')
            ->selectRaw('store_id, COUNT(*) as total')
            ->groupBy('store_id')
            ->pluck('total', 'store_id');

        return Inertia::render('pengaturan/toko', [
            'stores' => Store::query()
                ->orderByDesc('active')
                ->orderBy('name')
                ->get()
                ->map(fn (Store $store): array => [
                    'id' => $store->id,
                    'code' => $store->code,
                    'notaPrefix' => $store->notaPrefix(),
                    'name' => $store->name,
                    'address' => $store->address,
                    'phone' => $store->phone,
                    'active' => $store->active,
                    'transactionCount' => (int) ($txCounts[$store->id] ?? 0),
                    'clerkCount' => (int) ($clerkCounts[$store->id] ?? 0),
                ]),
            'suggestedCode' => Store::nextCode(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate($this->rules());

        $store = Store::create([
            'code' => $data['code'],
            'name' => $data['name'],
            'nota_prefix' => strtoupper($data['nota_prefix']),
            'address' => $data['address'] ?? null,
            'phone' => $data['phone'] ?? null,
            'active' => true,
        ]);

        ActivityLog::record('created', 'store', $store->code, $store->name, 'Menambah toko');

        return back()->with('success', "Toko {$store->name} ditambahkan.");
    }

    public function update(Request $request, Store $store): RedirectResponse
    {
        $data = $request->validate($this->rules($store));

        $store->update([
            'code' => $data['code'],
            'name' => $data['name'],
            'nota_prefix' => strtoupper($data['nota_prefix']),
            'address' => $data['address'] ?? null,
            'phone' => $data['phone'] ?? null,
            'active' => $data['active'] ?? $store->active,
        ]);

        ActivityLog::record('updated', 'store', $store->code, $store->name, 'Memperbarui toko');

        return back()->with('success', "Toko {$store->name} diperbarui.");
    }

    public function destroy(Store $store): RedirectResponse
    {
        if ($store->transactions()->exists() || $store->clerks()->exists()) {
            return back()->with('error', 'Toko masih punya transaksi atau petugas. Nonaktifkan saja daripada menghapus.');
        }

        $name = $store->name;
        $code = $store->code;
        $store->delete();

        ActivityLog::record('deleted', 'store', $code, $name, 'Menghapus toko');

        return back()->with('success', "Toko {$name} dihapus.");
    }

    /**
     * Switch the active store for a management user. "all" clears the filter
     * (overview across every store); an id scopes the app to that store.
     */
    public function switch(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'store' => ['required'],
        ]);

        if ($data['store'] === 'all') {
            $request->session()->forget('active_store_id');

            return back()->with('success', 'Menampilkan semua toko.');
        }

        $store = Store::query()->whereKey($data['store'])->first();

        if (! $store) {
            return back()->with('error', 'Toko tidak ditemukan.');
        }

        $request->session()->put('active_store_id', $store->id);

        return back()->with('success', "Toko aktif: {$store->name}.");
    }

    /**
     * Validation rules for creating/updating a store.
     *
     * @return array<string, mixed>
     */
    private function rules(?Store $store = null): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'code' => ['required', 'string', 'max:20', Rule::unique('stores', 'code')->ignore($store?->id)],
            'nota_prefix' => ['required', 'string', 'alpha_num', 'max:10', Rule::unique('stores', 'nota_prefix')->ignore($store?->id)],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'active' => ['sometimes', 'boolean'],
        ];
    }
}
