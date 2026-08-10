<?php

use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;

function methodTx(array $overrides = []): Transaction
{
    $customer = Customer::firstOrCreate(
        ['code' => 'PLG-060'],
        ['name' => 'Gilang', 'phone' => '0812', 'join_date' => '2026-07-01'],
    );

    return Transaction::create(array_merge([
        'code' => 'GCG-20260805-0060', 'customer_id' => $customer->id,
        'device_owner' => 'Gilang', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => '2026-08-05', 'due_date' => '2026-08-20', 'status' => 'AKTIF',
        'approval_status' => 'approved', 'clerk' => 'Rina',
    ], $overrides));
}

test('redeeming records the chosen payment method', function () {
    $tx = methodTx();

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/tebus", ['payment_method' => 'transfer'])
        ->assertRedirect();

    expect($tx->events()->where('type', 'redeemed')->value('payment_method'))->toBe('transfer');
});

test('redeeming defaults to cash when no method is chosen', function () {
    $tx = methodTx();

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/tebus")
        ->assertRedirect();

    expect($tx->events()->where('type', 'redeemed')->value('payment_method'))->toBe('cash');
});

test('extending records the chosen payment method', function () {
    $tx = methodTx();

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/perpanjang", [
            'mode' => '15', 'fee_paid' => true, 'payment_method' => 'transfer',
        ])
        ->assertRedirect();

    expect($tx->events()->where('type', 'extended')->value('payment_method'))->toBe('transfer');
});

test('a cash-in method can be edited inline from the kas table', function () {
    $tx = methodTx();
    $event = $tx->events()->create([
        'type' => 'redeemed', 'event_date' => '2026-08-07', 'title' => 'Ditebus',
        'by' => 'Rina', 'amount' => 1_100_000, 'payment_method' => 'cash',
    ]);

    // Default factory user is a petugas — they may reconcile the drawer.
    $this->actingAs(User::factory()->create())
        ->patch("/kas/entri/{$event->id}/metode", ['payment_method' => 'transfer'])
        ->assertRedirect();

    expect($event->refresh()->payment_method)->toBe('transfer');
});

test('a non cash-in event cannot have its method edited', function () {
    $tx = methodTx();
    $created = $tx->events()->create([
        'type' => 'created', 'event_date' => '2026-08-05', 'title' => 'Gadai masuk',
        'by' => 'Rina', 'amount' => 1_000_000,
    ]);

    $this->actingAs(User::factory()->create())
        ->patch("/kas/entri/{$created->id}/metode", ['payment_method' => 'transfer'])
        ->assertForbidden();

    expect($created->refresh()->payment_method)->toBeNull();
});
