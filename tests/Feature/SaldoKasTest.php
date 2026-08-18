<?php

use App\Models\CashAnchor;
use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use Inertia\Testing\AssertableInertia as Assert;

test('setting the cash balance stores an anchor and drives Saldo Awal', function () {
    $this->actingAs(User::factory()->create())
        ->post('/kas/saldo', ['amount' => 10_000_000, 'date' => '2026-08-14'])
        ->assertRedirect();

    expect(CashAnchor::whereDate('anchor_date', '2026-08-14')->value('amount'))->toBe(10_000_000);

    $this->actingAs(User::factory()->create())
        ->get('/kas?from=2026-08-14&to=2026-08-14')
        ->assertInertia(fn (Assert $page) => $page->where('saldoAwal', 10_000_000));
});

test('Saldo Awal carries yesterday net forward from the anchor', function () {
    $customer = Customer::create([
        'code' => 'PLG-130', 'name' => 'Rudi', 'phone' => '0812', 'join_date' => '2026-08-01',
    ]);
    $tx = Transaction::create([
        'code' => 'GCG-20260813-0001', 'customer_id' => $customer->id,
        'device_owner' => 'Rudi', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => '2026-08-13', 'due_date' => '2026-08-28', 'status' => 'PERPANJANG',
        'approval_status' => 'approved', 'clerk' => 'Atul',
    ]);
    // On 13 Aug: perpanjang +100.000 (in), pencairan −1.000.000 (out) => net −900.000.
    $tx->events()->createMany([
        ['type' => 'extended', 'event_date' => '2026-08-13', 'title' => 'x', 'by' => 'Atul', 'amount' => 100_000],
        ['type' => 'created', 'event_date' => '2026-08-13', 'title' => 'x', 'by' => 'Atul', 'amount' => 1_000_000],
    ]);
    // Opening balance for 13 Aug.
    CashAnchor::create(['store_id' => null, 'wallet_id' => Wallet::defaultId(), 'anchor_date' => '2026-08-13', 'amount' => 5_000_000]);

    // 14 Aug opening = 5.000.000 + net(13 Aug) = 5.000.000 − 900.000.
    $this->actingAs(User::factory()->create())
        ->get('/kas?from=2026-08-14&to=2026-08-14')
        ->assertInertia(fn (Assert $page) => $page->where('saldoAwal', 4_100_000));
});

test('Saldo Awal is null before any anchor is set', function () {
    $this->actingAs(User::factory()->create())
        ->get('/kas?from=2026-08-14&to=2026-08-14')
        ->assertInertia(fn (Assert $page) => $page->where('saldoAwal', null));
});

test('setting the cash balance requires a positive amount', function () {
    $this->actingAs(User::factory()->create())
        ->post('/kas/saldo', ['amount' => -5])
        ->assertSessionHasErrors('amount');
});
