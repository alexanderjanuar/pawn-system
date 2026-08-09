<?php

use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function cashFlowTx(array $overrides = []): Transaction
{
    $customer = Customer::firstOrCreate(
        ['code' => 'PLG-050'],
        ['name' => 'Fikri', 'phone' => '0812', 'join_date' => '2026-07-01'],
    );

    return Transaction::create(array_merge([
        'code' => 'GCG-20260805-0001', 'customer_id' => $customer->id,
        'device_owner' => 'Fikri', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => '2026-08-05', 'due_date' => '2026-08-20', 'status' => 'AKTIF',
        'approval_status' => 'approved', 'clerk' => 'Rina',
    ], $overrides));
}

test('the kas page sums money in and out for the period', function () {
    $tx = cashFlowTx();

    $tx->events()->createMany([
        ['type' => 'created', 'event_date' => '2026-08-05', 'title' => 'Gadai masuk', 'by' => 'Rina', 'amount' => 1_000_000],
        ['type' => 'extended', 'event_date' => '2026-08-06', 'title' => 'Diperpanjang', 'by' => 'Rina', 'amount' => 100_000],
        ['type' => 'redeemed', 'event_date' => '2026-08-07', 'title' => 'Ditebus', 'by' => 'Rina', 'amount' => 1_100_000],
    ]);

    // Default factory user is a petugas — proves petugas can access kas.
    $this->actingAs(User::factory()->create())
        ->get('/kas?from=2026-08-01&to=2026-08-31')
        ->assertInertia(fn (Assert $page) => $page
            ->component('kas')
            ->where('cashFlow.in.tebus', 1_100_000)
            ->where('cashFlow.in.perpanjang', 100_000)
            ->where('cashFlow.in.total', 1_200_000)
            ->where('cashFlow.out.pencairan', 1_000_000)
            ->where('cashFlow.out.total', 1_000_000)
            ->where('cashFlow.net', 200_000)
            ->has('cashFlow.entries', 3),
        );
});

test('cash flow excludes pending disbursements and non-sale auction events', function () {
    $pending = cashFlowTx(['code' => 'GCG-20260805-0002', 'approval_status' => 'pending']);
    $pending->events()->create([
        'type' => 'created', 'event_date' => '2026-08-05', 'title' => 'Gadai masuk', 'by' => 'Rina', 'amount' => 1_000_000,
    ]);

    $lelang = cashFlowTx(['code' => 'GCG-20260805-0003', 'status' => 'LELANG']);
    $lelang->events()->createMany([
        ['type' => 'auctioned', 'event_date' => '2026-08-06', 'title' => 'Ditandai untuk lelang', 'by' => 'Rina', 'amount' => null],
        ['type' => 'auctioned', 'event_date' => '2026-08-07', 'title' => 'Terjual lelang', 'by' => 'Rina', 'amount' => 1_500_000],
    ]);

    $this->actingAs(User::factory()->create())
        ->get('/kas?from=2026-08-01&to=2026-08-31')
        ->assertInertia(fn (Assert $page) => $page
            ->where('cashFlow.out.total', 0)
            ->where('cashFlow.in.lelang', 1_500_000)
            ->where('cashFlow.in.total', 1_500_000)
            ->has('cashFlow.entries', 1),
        );
});

test('cash flow only counts movements inside the selected period', function () {
    $tx = cashFlowTx();
    $tx->events()->createMany([
        ['type' => 'redeemed', 'event_date' => '2026-08-07', 'title' => 'Ditebus', 'by' => 'Rina', 'amount' => 1_100_000],
        ['type' => 'redeemed', 'event_date' => '2026-07-30', 'title' => 'Ditebus lama', 'by' => 'Rina', 'amount' => 999_000],
    ]);

    $this->actingAs(User::factory()->create())
        ->get('/kas?from=2026-08-01&to=2026-08-31')
        ->assertInertia(fn (Assert $page) => $page
            ->where('cashFlow.in.total', 1_100_000)
            ->has('cashFlow.entries', 1),
        );
});

test('the kas page defaults to today', function () {
    $today = now()->toDateString();

    $this->actingAs(User::factory()->create())
        ->get('/kas')
        ->assertInertia(fn (Assert $page) => $page
            ->component('kas')
            ->where('period.from', $today)
            ->where('period.to', $today),
        );
});

test('the full report carries cash flow for management but stays closed to petugas', function () {
    $this->actingAs(User::factory()->petugas()->create())
        ->get('/laporan')
        ->assertForbidden();

    $this->actingAs(User::factory()->owner()->create())
        ->get('/laporan?from=2026-08-01&to=2026-08-31')
        ->assertInertia(fn (Assert $page) => $page->has('cashFlow'));
});
