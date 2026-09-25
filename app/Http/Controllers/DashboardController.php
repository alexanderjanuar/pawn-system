<?php

namespace App\Http\Controllers;

use App\Http\Resources\ActivityResource;
use App\Http\Resources\TransactionResource;
use App\Models\ActivityLog;
use App\Models\Transaction;
use App\Models\TransactionEvent;
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
            'monthIncome' => $this->monthIncome(),
        ]);
    }

    /**
     * Income earned in the running month: extension fees, plus what a
     * redemption paid on top of the loan (deposit fee and any late fee).
     * Same definition as the Laporan page's total, scoped to this month, so
     * the two screens never disagree.
     */
    private function monthIncome(): int
    {
        return (int) TransactionEvent::query()
            ->with('transaction:id,principal')
            ->whereHas('transaction', fn ($query) => $query->forActiveStore())
            ->whereIn('type', ['extended', 'redeemed'])
            ->whereDate('event_date', '>=', now()->startOfMonth()->toDateString())
            ->whereDate('event_date', '<=', now()->endOfMonth()->toDateString())
            ->get()
            ->sum(fn (TransactionEvent $event): int => $event->type === 'redeemed'
                ? max(0, (int) $event->amount - (int) ($event->transaction?->principal ?? 0))
                : (int) $event->amount);
    }
}
