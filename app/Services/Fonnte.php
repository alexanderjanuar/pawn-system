<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Minimal client for the Fonnte WhatsApp gateway (fonnte.com).
 * Sending never throws — failures are logged and reported via the return value
 * so a WA hiccup can't break the main flow.
 */
class Fonnte
{
    public function __construct(
        private ?string $token,
        private string $endpoint = 'https://api.fonnte.com/send',
    ) {}

    public function isConfigured(): bool
    {
        return filled($this->token);
    }

    /**
     * Send a WhatsApp text message to a phone number (e.g. 081xxxx / 62xxxx).
     */
    public function send(?string $target, string $message): bool
    {
        if (! $this->isConfigured() || blank($target)) {
            return false;
        }

        try {
            $response = Http::timeout(10)
                ->withHeaders(['Authorization' => $this->token])
                ->asForm()
                ->post($this->endpoint, [
                    'target' => $target,
                    'message' => $message,
                ]);

            if (! $response->successful()) {
                Log::warning('Fonnte send failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return false;
            }

            return true;
        } catch (\Throwable $e) {
            Log::warning('Fonnte send error: '.$e->getMessage());

            return false;
        }
    }
}
