<?php

use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;

function revertExtendTx(array $overrides = []): Transaction
{
    $customer = Customer::firstOrCreate(
        ['code' => 'PLG-100'],
        ['name' => 'Solihin', 'phone' => '0812', 'join_date' => '2026-07-01'],
    );

    return Transaction::create(array_merge([
        'code' => 'GCG-20260813-0346', 'customer_id' => $customer->id,
        'device_owner' => 'Solihin', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 5, 'fee' => 50_000,
        'start_date' => '2026-07-14', 'due_date' => '2026-09-11', 'status' => 'PERPANJANG',
        'approval_status' => 'approved', 'clerk' => 'Atul', 'extensions' => 2,
    ], $overrides));
}

test('reverting a double extension rolls the due date back and deletes its payment', function () {
    $tx = revertExtendTx();
    $tx->events()->createMany([
        ['type' => 'extended', 'event_date' => '2026-08-13', 'title' => 'Diperpanjang 1', 'by' => 'Atul', 'amount' => 50_000],
        ['type' => 'extended', 'event_date' => '2026-08-13', 'title' => 'Diperpanjang 2', 'by' => 'Atul', 'amount' => 50_000],
    ]);

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/perpanjang/batal")
        ->assertRedirect();

    $tx->refresh();
    expect($tx->due_date->toDateString())->toBe('2026-08-27') // 2026-09-11 minus 15 days
        ->and($tx->extensions)->toBe(1)
        ->and($tx->status)->toBe('PERPANJANG')
        ->and($tx->events()->where('type', 'extended')->count())->toBe(1);
});

test('reverting the last remaining extension returns the loan to active', function () {
    $tx = revertExtendTx(['extensions' => 1]);
    $tx->events()->create([
        'type' => 'extended', 'event_date' => '2026-08-13', 'title' => 'Diperpanjang', 'by' => 'Atul', 'amount' => 50_000,
    ]);

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/perpanjang/batal")
        ->assertRedirect();

    $tx->refresh();
    expect($tx->extensions)->toBe(0)
        ->and($tx->status)->toBe('AKTIF')
        ->and($tx->events()->where('type', 'extended')->count())->toBe(0);
});

test('a loan with no extensions cannot be reverted', function () {
    $tx = revertExtendTx(['extensions' => 0, 'status' => 'AKTIF']);

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/perpanjang/batal")
        ->assertRedirect();

    expect($tx->refresh()->due_date->toDateString())->toBe('2026-09-11'); // unchanged
});
