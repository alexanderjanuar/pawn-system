<?php

namespace App\Http\Controllers;

use App\Http\Resources\TransactionResource;
use App\Models\Transaction;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CekStatusController extends Controller
{
    public function index(Request $request): Response
    {
        $kode = trim((string) $request->query('kode', ''));
        $hp = trim((string) $request->query('hp', ''));

        // Both are required to reveal data. A code alone (e.g. scanned from the
        // nota QR) only prefills the form; the phone still gates the details so
        // a stray nota can't expose a customer's data.
        $searched = $kode !== '' && $hp !== '';

        $result = null;

        if ($searched) {
            $transaction = Transaction::with(['customer', 'events'])
                ->whereRaw('UPPER(code) = ?', [strtoupper($kode)])
                ->first();

            if ($transaction) {
                $digits = preg_replace('/\D/', '', $hp);
                $stored = preg_replace('/\D/', '', $transaction->customer->phone);
                if ($digits !== $stored) {
                    $transaction = null;
                }
            }

            $result = $transaction ? new TransactionResource($transaction) : null;
        }

        return Inertia::render('cek-status', [
            'result' => $result,
            'searched' => $searched,
            'query' => ['kode' => $kode, 'hp' => $hp],
        ]);
    }
}
