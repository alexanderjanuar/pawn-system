<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\CashEntry;
use App\Models\Store;
use App\Models\Wallet;
use App\Support\ActiveStore;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Shop operating costs (rent, electricity, wages, supplies). Each one is a
 * categorised cash-out, so it leaves Kas Harian like any other manual
 * expense and is subtracted from income on the report.
 */
class BiayaOperasionalController extends Controller
{
    public function index(Request $request): Response
    {
        [$from, $to] = $this->period($request);
        $storeId = app(ActiveStore::class)->id();

        $expenses = CashEntry::query()
            ->expense()
            ->with(['store', 'wallet'])
            ->when($storeId !== null, fn (Builder $q) => $q->where('store_id', $storeId))
            ->when($from !== '', fn (Builder $q) => $q->whereDate('entry_date', '>=', $from))
            ->when($to !== '', fn (Builder $q) => $q->whereDate('entry_date', '<=', $to))
            ->orderByDesc('entry_date')
            ->orderByDesc('id')
            ->get();

        $byCategory = collect(CashEntry::EXPENSE_CATEGORIES)
            ->map(fn (string $label, string $key): array => [
                'key' => $key,
                'label' => $label,
                'total' => (int) $expenses->where('category', $key)->sum('amount'),
                'count' => $expenses->where('category', $key)->count(),
            ])
            ->filter(fn (array $row): bool => $row['count'] > 0)
            ->sortByDesc('total')
            ->values()
            ->all();

        // An entry without a pocket is counted against the default one in Kas
        // Harian, so name it the same way here.
        $defaultWallet = Wallet::query()->find(Wallet::defaultId())?->name;

        return Inertia::render('biaya-operasional', [
            'expenses' => $expenses->map(fn (CashEntry $entry): array => [
                'id' => $entry->id,
                'date' => $entry->entry_date->format('Y-m-d'),
                'category' => $entry->category,
                'categoryLabel' => $entry->categoryLabel(),
                'description' => $entry->description,
                'note' => $entry->note,
                'amount' => (int) $entry->amount,
                'method' => $entry->method,
                'walletName' => $entry->wallet?->name ?? $defaultWallet,
                'storeName' => $entry->store?->name,
                'by' => $entry->by,
            ])->values(),
            'summary' => [
                'total' => (int) $expenses->sum('amount'),
                'count' => $expenses->count(),
                'byCategory' => $byCategory,
            ],
            'categories' => collect(CashEntry::EXPENSE_CATEGORIES)
                ->map(fn (string $label, string $key): array => ['key' => $key, 'label' => $label])
                ->values()
                ->all(),
            'period' => ['from' => $from, 'to' => $to],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $storeId = $this->resolveStore();

        if ($storeId === false) {
            return back()->with('error', 'Pilih satu toko dari pemilih toko di atas untuk mencatat biaya.');
        }

        $data = $request->validate([
            'date' => ['required', 'date', 'before_or_equal:today'],
            'category' => ['required', 'in:'.implode(',', array_keys(CashEntry::EXPENSE_CATEGORIES))],
            'description' => ['required', 'string', 'max:120'],
            'note' => ['nullable', 'string', 'max:255'],
            'amount' => ['required', 'integer', 'min:1'],
            'method' => ['nullable', 'in:cash,transfer'],
            'wallet_id' => ['nullable', 'integer', 'exists:wallets,id'],
        ], [
            'date.before_or_equal' => 'Tanggal biaya tidak boleh di masa depan.',
        ]);

        $entry = CashEntry::create([
            'store_id' => $storeId,
            'entry_date' => $data['date'],
            'direction' => 'out',
            'category' => $data['category'],
            'amount' => (int) $data['amount'],
            'description' => $data['description'],
            'note' => blank($data['note'] ?? null) ? null : $data['note'],
            'method' => $data['method'] ?? 'cash',
            'by' => $request->user()?->name,
            'wallet_id' => $data['wallet_id'] ?? Wallet::defaultId(),
        ]);

        ActivityLog::record(
            'created',
            'biaya',
            $entry->categoryLabel(),
            $entry->description,
            'Mencatat biaya operasional '.$this->rupiah($entry->amount),
        );

        return back()->with('success', 'Biaya operasional dicatat.');
    }

    public function destroy(CashEntry $cashEntry): RedirectResponse
    {
        abort_unless($cashEntry->isExpense(), 404);

        // Petugas are locked to their store; "Semua Toko" is the owner overview.
        $storeId = app(ActiveStore::class)->id();
        abort_unless($storeId === null || $cashEntry->store_id === $storeId, 403);

        $label = $cashEntry->categoryLabel();
        $description = $cashEntry->description;
        $amount = (int) $cashEntry->amount;
        $date = $cashEntry->entry_date->format('Y-m-d');

        $cashEntry->delete();

        // Removing a record of money spent changes the cash book, so the owner
        // gets to look at it.
        ActivityLog::record(
            'deleted',
            'biaya',
            $label,
            $description,
            "Menghapus biaya operasional {$this->rupiah($amount)} (tanggal {$date})",
            null,
            true,
        );

        return back()->with('success', 'Biaya operasional dihapus.');
    }

    /**
     * Reporting period from the query string, defaulting to the running month.
     *
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
     * The store a new cost belongs to (the active store). False when a
     * management user is on "Semua Toko" and must pick one; null in a
     * single-shop setup with no stores.
     */
    private function resolveStore(): int|false|null
    {
        $activeId = app(ActiveStore::class)->id();

        if ($activeId !== null) {
            return $activeId;
        }

        return Store::query()->exists() ? false : null;
    }

    private function rupiah(int $amount): string
    {
        return 'Rp '.number_format($amount, 0, ',', '.');
    }
}
