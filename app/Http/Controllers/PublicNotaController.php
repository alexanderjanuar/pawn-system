<?php

namespace App\Http\Controllers;

use App\Models\Transaction;
use App\Services\NotaPdf;
use Symfony\Component\HttpFoundation\Response;

class PublicNotaController extends Controller
{
    /**
     * Serve a transaction's nota PDF to anyone holding its (unguessable) share
     * token. This is the short public link handed to the customer over WhatsApp.
     */
    public function __invoke(string $token, NotaPdf $pdf): Response
    {
        $transaction = Transaction::where('share_token', $token)->firstOrFail();

        // Inline so it opens in the browser / WhatsApp viewer instead of forcing
        // a download; the customer can still save or print from there.
        return $pdf->make($transaction)->stream($pdf->filename($transaction), ['Attachment' => false]);
    }
}
