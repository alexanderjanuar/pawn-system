<?php

namespace App\Http\Middleware;

use App\Models\Store;
use App\Support\ActiveStore;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetActiveStore
{
    public function __construct(private ActiveStore $activeStore) {}

    /**
     * Resolve the store the request operates on. Petugas are locked to their
     * own branch; management default to "all stores" and may switch (stored in
     * the session). A null id means no store filter is applied.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ! $user->isManagement()) {
            $this->activeStore->set($user->store_id);

            return $next($request);
        }

        $sessionId = $request->session()->get('active_store_id');

        $this->activeStore->set(
            $sessionId !== null && Store::whereKey($sessionId)->exists()
                ? (int) $sessionId
                : null,
        );

        return $next($request);
    }
}
