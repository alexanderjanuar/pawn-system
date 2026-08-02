<?php

namespace App\Http\Controllers;

use App\Http\Resources\TransactionResource;
use App\Models\ActivityLog;
use App\Models\Transaction;
use App\Models\TransactionEvent;
use Inertia\Inertia;
use Inertia\Response;

class TransaksiController extends Controller
{
    public function index(): Response
    {
        $transactions = Transaction::with(['customer', 'events'])
            ->forActiveStore()
            ->orderByDesc('start_date')
            ->get();

        return Inertia::render('transaksi/index', [
            'transactions' => TransactionResource::collection($transactions),
        ]);
    }

    public function show(Transaction $transaction): Response
    {
        $transaction->load(['customer', 'events', 'rak']);

        return Inertia::render('transaksi/show', [
            'transaction' => new TransactionResource($transaction),
            'history' => $this->history($transaction),
        ]);
    }

    /**
     * Merged, time-stamped change history for one transaction: business
     * milestones (transaction_events) plus every edit recorded in the audit
     * log, newest first.
     *
     * @return array<int, array<string, mixed>>
     */
    private function history(Transaction $transaction): array
    {
        $events = $transaction->events->map(function (TransactionEvent $event) {
            $stamp = $event->created_at ?? $event->event_date;
            $at = $event->event_date->copy()->setTimeFrom($stamp);

            return [
                'at' => $at->getTimestamp(),
                'kind' => $event->type,
                'date' => $event->event_date->format('Y-m-d'),
                'time' => $stamp->format('H.i'),
                'title' => $event->title,
                'note' => $event->note,
                'by' => $event->by,
                'amount' => $event->amount,
                'changes' => [],
            ];
        });

        $edits = ActivityLog::query()
            ->where('subject_type', 'transaction')
            ->where('subject_code', $transaction->code)
            ->where('action', 'updated')
            ->get()
            ->map(fn (ActivityLog $log) => [
                'at' => $log->created_at->getTimestamp(),
                'kind' => 'updated',
                'date' => $log->created_at->format('Y-m-d'),
                'time' => $log->created_at->format('H.i'),
                'title' => $log->description,
                'note' => null,
                'by' => $log->actor,
                'amount' => null,
                'changes' => $log->changes ?? [],
            ]);

        return $events->concat($edits)
            ->sortByDesc('at')
            ->values()
            ->map(function (array $item) {
                unset($item['at']); // internal sort key only

                return $item;
            })
            ->all();
    }

    public function nota(Transaction $transaction): Response
    {
        $transaction->load(['customer', 'events']);

        return Inertia::render('transaksi/nota', [
            'transaction' => new TransactionResource($transaction),
        ]);
    }
}
