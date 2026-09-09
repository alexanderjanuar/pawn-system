<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Minimal client for the Fonnte WhatsApp gateway (fonnte.com).
 * Sending never throws: failures are logged and reported via the return value
 * so a WA hiccup can't break the main flow.
 */
class Fonnte
{
    /** Why the last send failed, in Indonesian, for the clerk to act on. */
    private ?string $lastError = null;

    public function __construct(
        private ?string $token,
        private string $endpoint = 'https://api.fonnte.com/send',
        private string $deviceEndpoint = 'https://api.fonnte.com/device',
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
        $this->lastError = null;

        if (! $this->isConfigured()) {
            $this->lastError = 'Pengaturan WhatsApp belum diisi.';

            return false;
        }

        if (blank($target)) {
            $this->lastError = 'Nomor tujuan kosong.';

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
                $this->lastError = 'Gateway WhatsApp tidak merespons (kode '.$response->status().').';

                Log::warning('Fonnte send failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return false;
            }

            // Fonnte answers 200 even when it refuses to send (device offline,
            // quota gone, bad number), so the body is what actually decides.
            if (! filter_var($response->json('status'), FILTER_VALIDATE_BOOLEAN)) {
                $this->lastError = $this->explain((string) $response->json('reason', ''));

                Log::warning('Fonnte rejected the message', [
                    'body' => $response->body(),
                ]);

                return false;
            }

            return true;
        } catch (\Throwable $e) {
            $this->lastError = 'Tidak bisa menghubungi gateway WhatsApp.';

            Log::warning('Fonnte send error: '.$e->getMessage());

            return false;
        }
    }

    /**
     * Why the last send failed, or null when it succeeded.
     */
    public function lastError(): ?string
    {
        return $this->lastError;
    }

    /**
     * Health of the sending WhatsApp number, for a "cek koneksi" check.
     *
     * @return array{connected: bool, device: string|null, name: string|null, quota: string|null, expired: string|null, reason: string|null}
     */
    public function deviceStatus(): array
    {
        $unknown = [
            'connected' => false, 'device' => null, 'name' => null,
            'quota' => null, 'expired' => null, 'reason' => 'Pengaturan WhatsApp belum diisi.',
        ];

        if (! $this->isConfigured()) {
            return $unknown;
        }

        try {
            $response = Http::timeout(10)
                ->withHeaders(['Authorization' => $this->token])
                ->post($this->deviceEndpoint);

            if (! $response->successful()) {
                return [...$unknown, 'reason' => 'Gateway WhatsApp tidak merespons.'];
            }

            $connected = $response->json('device_status') === 'connect';

            return [
                'connected' => $connected,
                'device' => $response->json('device'),
                'name' => $response->json('name'),
                'quota' => $response->json('quota'),
                'expired' => $response->json('expired'),
                'reason' => $connected
                    ? null
                    : 'Nomor WhatsApp pengirim sedang terputus. Sambungkan ulang (scan QR) di dashboard Fonnte.',
            ];
        } catch (\Throwable $e) {
            Log::warning('Fonnte device check error: '.$e->getMessage());

            return [...$unknown, 'reason' => 'Tidak bisa menghubungi gateway WhatsApp.'];
        }
    }

    /**
     * Turn Fonnte's English reason into something a clerk can act on.
     */
    private function explain(string $reason): string
    {
        return match (true) {
            str_contains($reason, 'disconnected device') => 'Nomor WhatsApp pengirim sedang terputus. Sambungkan ulang (scan QR) di dashboard Fonnte.',
            str_contains($reason, 'quota') => 'Kuota pesan WhatsApp habis.',
            str_contains($reason, 'token') => 'Token WhatsApp tidak valid.',
            str_contains($reason, 'target') => 'Nomor tujuan tidak valid.',
            $reason !== '' => 'Gagal kirim WhatsApp: '.$reason,
            default => 'Pesan ditolak gateway WhatsApp.',
        };
    }
}
