<?php

use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function lelangTx(string $status = 'AKTIF'): Transaction
{
    $customer = Customer::firstOrCreate(
        ['code' => 'PLG-001'],
        ['name' => 'A', 'phone' => '081', 'join_date' => '2026-07-01'],
    );

    return Transaction::create([
        'code' => 'GCG-20260720-0001', 'customer_id' => $customer->id,
        'device_owner' => 'A', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 2_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 200_000,
        'start_date' => '2026-07-20', 'due_date' => '2026-08-04',
        'status' => $status, 'clerk' => 'Rina',
    ]);
}

test('an overdue item can be marked for auction', function () {
    $tx = lelangTx('TIDAK_DIAMBIL');

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/lelang")
        ->assertRedirect();

    expect($tx->refresh()->status)->toBe('LELANG');
});

test('a redeemed item cannot be marked for auction', function () {
    $tx = lelangTx('DIAMBIL');

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/lelang")
        ->assertRedirect();

    expect($tx->refresh()->status)->toBe('DIAMBIL');
});

test('a sale can be recorded for a lelang item', function () {
    $tx = lelangTx('LELANG');

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/sale", ['sale_value' => 2_500_000])
        ->assertRedirect();

    $tx->refresh();
    expect($tx->sale_value)->toBe(2_500_000)
        ->and($tx->sold_at)->not->toBeNull();
});

test('recording a sale requires a value', function () {
    $tx = lelangTx('LELANG');

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/sale", [])
        ->assertSessionHasErrors('sale_value');
});

test('a sale cannot be recorded for a non-lelang item', function () {
    $tx = lelangTx('AKTIF');

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/sale", ['sale_value' => 1000])
        ->assertRedirect();

    expect($tx->refresh()->sale_value)->toBeNull();
});

test('the lelang report lists only auctioned items', function () {
    lelangTx('LELANG');

    $this->actingAs(User::factory()->owner()->create())
        ->get('/laporan/lelang')
        ->assertInertia(fn (Assert $page) => $page
            ->component('laporan/lelang')
            ->has('transactions', 1),
        );
});
