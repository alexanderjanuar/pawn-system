<?php

use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function incomeTx(): Transaction
{
    $customer = Customer::firstOrCreate(
        ['code' => 'PLG-090'],
        ['name' => 'Ika', 'phone' => '0812', 'join_date' => '2026-07-01'],
    );

    return Transaction::create([
        'code' => 'GCG-20260711-0496', 'customer_id' => $customer->id,
        'device_owner' => 'Ika', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 800_000, 'tenor_days' => 30, 'fee_percent' => 15, 'fee' => 120_000,
        'start_date' => '2026-07-11', 'due_date' => '2026-09-09', 'status' => 'DIAMBIL',
        'approval_status' => 'approved', 'clerk' => 'Atul',
    ]);
}

test('report income sums extension fees and redemption interest by payment date', function () {
    $tx = incomeTx();
    $tx->events()->createMany([
        // Disbursement (money out) is not income.
        ['type' => 'created', 'event_date' => '2026-07-11', 'title' => 'Gadai masuk', 'by' => 'Atul', 'amount' => 800_000],
        // Extension in August: Rp 120.000 interest.
        ['type' => 'extended', 'event_date' => '2026-08-11', 'title' => 'Diperpanjang', 'by' => 'Atul', 'amount' => 120_000],
        // Redemption in August: 800.000 pokok + 120.000 bunga → interest is 120.000.
        ['type' => 'redeemed', 'event_date' => '2026-08-20', 'title' => 'Ditebus', 'by' => 'Atul', 'amount' => 920_000],
    ]);

    $this->actingAs(User::factory()->owner()->create())
        ->get('/laporan?from=2026-08-01&to=2026-08-31')
        ->assertInertia(fn (Assert $page) => $page
            ->where('feeIncome.perpanjang', 120_000)
            ->where('feeIncome.tebus', 120_000) // 920k - 800k pokok
            ->where('feeIncome.total', 240_000),
        );
});

test('report income excludes payments made outside the period', function () {
    $tx = incomeTx();
    $tx->events()->createMany([
        ['type' => 'extended', 'event_date' => '2026-07-30', 'title' => 'Diperpanjang', 'by' => 'Atul', 'amount' => 99_000],
        ['type' => 'extended', 'event_date' => '2026-08-11', 'title' => 'Diperpanjang', 'by' => 'Atul', 'amount' => 120_000],
    ]);

    $this->actingAs(User::factory()->owner()->create())
        ->get('/laporan?from=2026-08-01&to=2026-08-31')
        ->assertInertia(fn (Assert $page) => $page
            ->where('feeIncome.perpanjang', 120_000) // July extension excluded
            ->where('feeIncome.total', 120_000),
        );
});
