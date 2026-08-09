<?php

use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Support\Facades\Http;

function reminderTx(string $phone = '081234567890'): Transaction
{
    $customer = Customer::create([
        'code' => 'PLG-009', 'name' => 'Andi', 'phone' => $phone,
        'address' => 'Jl. B', 'id_number' => '111', 'join_date' => '2026-07-01',
    ]);

    return Transaction::create([
        'code' => 'GCG-20260720-0009', 'customer_id' => $customer->id,
        'device_owner' => 'Andi', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => '2026-07-20', 'due_date' => '2026-08-04', 'status' => 'AKTIF',
        'approval_status' => 'approved', 'clerk' => 'Rina',
    ]);
}

beforeEach(function () {
    config(['services.fonnte.token' => 'test-token']);
    Http::fake(['api.fonnte.com/*' => Http::response(['status' => true])]);
});

test('a reminder is sent to the customer WhatsApp and logged', function () {
    $tx = reminderTx();

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/ingatkan", ['message' => 'Halo, gadai Anda jatuh tempo.'])
        ->assertRedirect();

    Http::assertSent(fn ($request) => $request->url() === 'https://api.fonnte.com/send'
        && $request['target'] === '081234567890'
        && str_contains($request['message'], 'jatuh tempo'));

    expect($tx->events()->where('title', 'Pengingat WhatsApp dikirim')->count())->toBe(1);
});

test('a reminder requires a message', function () {
    $tx = reminderTx();

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/ingatkan", ['message' => ''])
        ->assertSessionHasErrors('message');

    Http::assertNothingSent();
});

test('a reminder is not sent when the customer has no phone', function () {
    $tx = reminderTx('');

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/ingatkan", ['message' => 'Halo'])
        ->assertRedirect();

    Http::assertNothingSent();
});
