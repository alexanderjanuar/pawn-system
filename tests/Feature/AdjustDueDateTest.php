<?php

use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;

function adjustDueTx(array $overrides = []): Transaction
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

test('correcting the due date moves only the date and period, not the payment', function () {
    $tx = adjustDueTx();
    // The extension payment stays on its original day.
    $tx->events()->create([
        'type' => 'extended', 'event_date' => '2026-08-12', 'title' => 'Diperpanjang',
        'by' => 'Petugas Counter', 'amount' => 225_000,
    ]);

    // Fix a 15-day extension that should have been 30 days (25 Aug -> 9 Sep).
    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/jatuh-tempo", ['due_date' => '2026-09-09'])
        ->assertRedirect();

    $tx->refresh();
    expect($tx->due_date->toDateString())->toBe('2026-09-09')
        // current period start (10 Aug) unchanged; 10 Aug -> 9 Sep = 30 days
        ->and($tx->tenor_days)->toBe(30)
        // payment untouched: still one extended event, still dated 12 Aug, same amount
        ->and($tx->events()->where('type', 'extended')->count())->toBe(1)
        ->and($tx->events()->where('type', 'extended')->value('amount'))->toBe(225_000)
        ->and($tx->events()->where('type', 'extended')->value('event_date')->toDateString())->toBe('2026-08-12');
});

test('the due date must be after the start date', function () {
    $tx = adjustDueTx();

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/jatuh-tempo", ['due_date' => '2026-07-01'])
        ->assertSessionHasErrors('due_date');

    expect($tx->refresh()->due_date->toDateString())->toBe('2026-08-25');
});

test('a redeemed transaction due date cannot be corrected', function () {
    $tx = adjustDueTx(['status' => 'DIAMBIL']);

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/jatuh-tempo", ['due_date' => '2026-09-09'])
        ->assertRedirect();

    expect($tx->refresh()->due_date->toDateString())->toBe('2026-08-25');
});
