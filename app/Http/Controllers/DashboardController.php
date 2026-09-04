<?php

namespace App\Http\Controllers;

use App\Http\Resources\ActivityResource;
use App\Http\Resources\TransactionResource;
use App\Models\ActivityLog;
use App\Models\Transaction;
use App\Support\ActiveStore;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request): Response|RedirectResponse
    {
        // Petugas is operational-only: no financial dashboard. Send them to
        // their workspace instead of the business overview.
        if (! $request->user()->isManagement()) {
            return redirect()->route('transaksi.index');
        }

        $transactions = Transaction::with(['customer', 'events'])
            ->forActiveStore()
            ->orderByDesc('start_date')
            ->get();

        $pending = Transaction::with(['customer', 'events'])
            ->forActiveStore()
            ->where('approval_status', 'pending')
            ->orderByDesc('created_at')
            ->get();

        // Sensitive actions the owner has not worked through yet: cancelled
        // extensions, deleted transactions, discounts beyond the allowed share.
        $storeId = app(ActiveStore::class)->id();

        $review = ActivityLog::query()
            ->when($storeId !== null, fn ($query) => $query->where('store_id', $storeId))
            ->needsReview();

        return Inertia::render('dashboard', [
            'transactions' => TransactionResource::collection($transactions),
            'pendingApprovals' => TransactionResource::collection($pending),
            'reviewQueue' => ActivityResource::collection(
                (clone $review)->latest()->limit(8)->get(),
            ),
            'reviewCount' => $review->count(),
        ]);
    }
}
