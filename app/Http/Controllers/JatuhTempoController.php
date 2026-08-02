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
        $transactions = Transaction::with(['customer', 'events'])
            ->forActiveStore()
            ->whereIn('status', ['AKTIF', 'PERPANJANG', 'TIDAK_DIAMBIL'])
            ->orderBy('due_date')
            ->get();

        return Inertia::render('jatuh-tempo', [
            'transactions' => TransactionResource::collection($transactions),
        ]);
    }
}
