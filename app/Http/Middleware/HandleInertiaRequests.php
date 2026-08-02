<?php

namespace App\Http\Middleware;

use App\Models\Setting;
use App\Models\Store;
use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
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
                ? $this->overdueCount()
                : 0,
            'approvalThreshold' => (int) Setting::get('approval_threshold', Transaction::APPROVAL_THRESHOLD),
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            ...$this->storeProps($request),
        ];
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

        // Resolve the active store directly from the session/user here: shared
        // props are evaluated before route middleware runs, so the
        // SetActiveStore singleton is not populated yet at this point.
        if ($user->isManagement()) {
            $sessionId = $request->session()->get('active_store_id');
            $activeId = $sessionId !== null && Store::query()->whereKey($sessionId)->exists()
                ? (int) $sessionId
                : null;

            $stores = Store::query()->active()->orderBy('name')->get(['id', 'name', 'code'])
                ->map(fn (Store $store): array => [
                    'id' => $store->id,
                    'name' => $store->name,
                    'code' => $store->code,
                ])->all();
        } else {
            $activeId = $user->store_id;
            $stores = [];
        }

        return [
            'stores' => $stores,
            'activeStore' => $activeId ?? 'all',
            'activeStoreName' => $activeId !== null
                ? Store::query()->whereKey($activeId)->value('name')
                : ($user->isManagement() ? 'Semua Toko' : null),
        ];
    }

    /**
     * Items needing action (due today or overdue) for the sidebar badge.
     * Uses the design dataset's reference date (2026-07-19).
     */
    protected function overdueCount(): int
    {
        return Transaction::query()
            ->whereIn('status', ['AKTIF', 'PERPANJANG', 'TIDAK_DIAMBIL'])
            ->whereDate('due_date', '<=', Carbon::parse('2026-07-19'))
            ->count();
    }
}

