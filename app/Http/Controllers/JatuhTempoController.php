<?php

namespace App\Http\Controllers;

use App\Http\Resources\TransactionResource;
use App\Models\Transaction;
use Inertia\Inertia;
use Inertia\Response;

class JatuhTempoController extends Controller
{
    public function index(): Response
    {
        // Only pawns still awaiting a decision. "Tidak Diambil" is already an
        // action taken, so it no longer belongs in the to-do list here.
        $transactions = Transaction::with(['customer', 'events'])
            ->forActiveStore()
            ->whereIn('status', ['AKTIF', 'PERPANJANG'])
            ->orderBy('due_date')
            ->get();

        return Inertia::render('jatuh-tempo', [
            'transactions' => TransactionResource::collection($transactions),
        ]);
    }
}
