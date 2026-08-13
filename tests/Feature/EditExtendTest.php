<?php

use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;

function editExtendTx(array $overrides = []): Transaction
{
    $customer = Customer::firstOrCreate(
        ['code' => 'PLG-110'],
        ['name' => 'Hartatik', 'phone' => '0812', 'join_date' => '2026-07-01'],
    );

    return Transaction::create(array_merge([
        'code' => 'GCG-20260711-0487', 'customer_id' => $customer->id,
        'device_owner' => 'Hartatik', 'device_name' => 'HP', 'kelengkapan' => 'HP + Box',
        'principal' => 1_500_000, 'tenor_days' => 15, 'fee_percent' => 15, 'fee' => 225_000,
        'start_date' => '2026-07-11', 'due_date' => '2026-08-25', 'status' => 'PERPANJANG',
        'approval_status' => 'approved', 'clerk' => 'Atul', 'extensions' => 1,
    ], $overrides));
}

test('editing an extension fixes the date in place without moving the payment', function () {
    $tx = editExtendTx();
    $tx->events()->create([
        'type' => 'extended', 'event_date' => '2026-08-12', 'title' => 'Diperpanjang',
        'by' => 'Petugas Counter', 'amount' => 225_000, 'payment_method' => 'transfer',
    ]);

    // Fix a 15-day extension that should have been 30 days (25 Aug -> 9 Sep).
    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/perpanjang/edit", ['due_date' => '2026-09-09', 'fee' => 225_000])
        ->assertRedirect();

    $tx->refresh();
    expect($tx->due_date->toDateString())->toBe('2026-09-09')
        ->and($tx->tenor_days)->toBe(30) // current period start 10 Aug -> 9 Sep
        ->and($tx->fee)->toBe(225_000);

    $event = $tx->events()->where('type', 'extended')->latest('id')->first();
    // Payment date & method are preserved so cash/income stay on the right day.
    expect($event->amount)->toBe(225_000)
        ->and($event->payment_method)->toBe('transfer')
        ->and($event->event_date->toDateString())->toBe('2026-08-12');
});

test('editing an extension can also correct the fee', function () {
    $tx = editExtendTx();
    $tx->events()->create([
        'type' => 'extended', 'event_date' => '2026-08-12', 'title' => 'Diperpanjang', 'by' => 'Atul', 'amount' => 225_000,
    ]);

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/perpanjang/edit", ['due_date' => '2026-09-09', 'fee' => 300_000])
        ->assertRedirect();

    $tx->refresh();
    expect($tx->fee)->toBe(300_000)
        ->and($tx->fee_percent)->toBe(20) // 300k / 1.5M
        ->and($tx->events()->where('type', 'extended')->value('amount'))->toBe(300_000);
});

test('a transaction with no extension cannot be edited this way', function () {
    $tx = editExtendTx(['extensions' => 0, 'status' => 'AKTIF']);

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/perpanjang/edit", ['due_date' => '2026-09-09', 'fee' => 225_000])
        ->assertRedirect();

    expect($tx->refresh()->due_date->toDateString())->toBe('2026-08-25');
});

test('the edited due date must be after the start date', function () {
    $tx = editExtendTx();
    $tx->events()->create([
        'type' => 'extended', 'event_date' => '2026-08-12', 'title' => 'Diperpanjang', 'by' => 'Atul', 'amount' => 225_000,
    ]);

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/perpanjang/edit", ['due_date' => '2026-07-01', 'fee' => 225_000])
        ->assertSessionHasErrors('due_date');
});
