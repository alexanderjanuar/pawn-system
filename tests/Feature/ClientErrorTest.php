<?php

use App\Models\User;
use Illuminate\Support\Facades\Log;

test('a browser crash is written to the log with enough detail to act on', function () {
    Log::shouldReceive('error')
        ->once()
        ->withArgs(function (string $message, array $context): bool {
            return str_contains($message, "Cannot read properties of null (reading 'trim')")
                && $context['page'] === 'transaksi/create'
                && $context['url'] === '/gadai/baru'
                && $context['kind'] === 'render'
                && $context['user'] === 'Rina';
        });

    $this->actingAs(User::factory()->create(['name' => 'Rina']))
        ->postJson('/client-error', [
            'kind' => 'render',
            'message' => "Cannot read properties of null (reading 'trim')",
            'stack' => 'at blacklistMatch (gadai-form.tsx:246)',
            'page' => 'transaksi/create',
            'url' => '/gadai/baru',
        ])
        ->assertNoContent();
});

test('a crash report without a message is rejected', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/client-error', ['page' => 'transaksi/create'])
        ->assertUnprocessable();
});

test('guests cannot post crash reports', function () {
    $this->postJson('/client-error', ['message' => 'boom'])->assertUnauthorized();
});
