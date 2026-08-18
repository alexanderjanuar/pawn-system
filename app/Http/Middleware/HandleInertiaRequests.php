<?php

namespace App\Http\Middleware;

use App\Models\Setting;
use App\Models\Store;
use App\Models\Transaction;
use App\Models\Wallet;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
            ],
            'flash' => [
                'success' => $request->session()->get('success'),
                'error' => $request->session()->get('error'),
            ],
            'overdueCount' => $request->user()
                ? $this->overdueCount($this->resolveActiveStoreId($request))
                : 0,
            'approvalThreshold' => (int) Setting::get('approval_threshold', Transaction::APPROVAL_THRESHOLD),
            'wallets' => $request->user() ? $this->wallets() : [],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'serverDate' => now()->toDateString(),
            ...$this->storeProps($request),
        ];
    }

    /**
     * Active cash pockets, shared so every money form can offer a picker.
     *
     * @return array<int, array{id: int, name: string, isDefault: bool}>
     */
    protected function wallets(): array
    {
        return Wallet::query()
            ->active()
            ->orderBy('sort')
            ->orderBy('id')
            ->get(['id', 'name', 'is_default'])
            ->map(fn (Wallet $wallet): array => [
                'id' => $wallet->id,
                'name' => $wallet->name,
                'isDefault' => $wallet->is_default,
            ])
            ->all();
    }

    /**
     * The store the request is scoped to. Resolved directly from the
     * session/user because shared props are evaluated before route middleware
     * runs (so the SetActiveStore singleton is not populated yet). Null = all
     * stores (management overview) or single-shop with no stores yet.
     */
    protected function resolveActiveStoreId(Request $request): ?int
    {
        $user = $request->user();

        if (! $user) {
            return null;
        }

        if (! $user->isManagement()) {
            return $user->store_id;
        }

        $sessionId = $request->session()->get('active_store_id');

        return $sessionId !== null && Store::query()->whereKey($sessionId)->exists()
            ? (int) $sessionId
            : null;
    }

    /**
     * Store-switcher props: the stores a management user can switch between, and
     * which store the app is currently scoped to ("all" = every store).
     *
     * @return array{stores: array<int, array{id: int, name: string, code: string}>, activeStore: int|string, activeStoreName: string|null}
     */
    protected function storeProps(Request $request): array
    {
        $user = $request->user();

        if (! $user) {
            return ['stores' => [], 'activeStore' => 'all', 'activeStoreName' => null];
        }

        $activeId = $this->resolveActiveStoreId($request);

        $stores = $user->isManagement()
            ? Store::query()->active()->orderBy('name')->get(['id', 'name', 'code'])
                ->map(fn (Store $store): array => [
                    'id' => $store->id,
                    'name' => $store->name,
                    'code' => $store->code,
                ])->all()
            : [];

        return [
            'stores' => $stores,
            'activeStore' => $activeId ?? 'all',
            'activeStoreName' => $activeId !== null
                ? Store::query()->whereKey($activeId)->value('name')
                : ($user->isManagement() ? 'Semua Toko' : null),
        ];
    }

    /**
     * Items needing action (due today or overdue) for the sidebar badge,
     * scoped to the active store.
     */
    protected function overdueCount(?int $storeId): int
    {
        return Transaction::query()
            ->when($storeId !== null, fn ($query) => $query->where('store_id', $storeId))
            ->whereIn('status', ['AKTIF', 'PERPANJANG', 'TIDAK_DIAMBIL'])
            ->whereDate('due_date', '<=', now())
            ->count();
    }
}
