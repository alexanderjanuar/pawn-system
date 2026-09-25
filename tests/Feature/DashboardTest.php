<?php

use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use Inertia\Testing\AssertableInertia;

test('guests are redirected to the login page', function () {
    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('login'));
});

test('management users can visit the dashboard', function () {
    $this->actingAs(User::factory()->owner()->create());

    $this->get(route('dashboard'))->assertOk();
});

test('petugas is redirected from the dashboard to their workspace', function () {
    $this->actingAs(User::factory()->petugas()->create());

    $this->get(route('dashboard'))->assertRedirect(route('transaksi.index'));
});
test('the dashboard income card counts only the running month', function () {
    $customer = Customer::create([
        'code' => 'PLG-DSH', 'name' => 'Budi', 'phone' => '081200000009', 'join_date' => '2026-01-01',
    ]);
    $tx = Transaction::create([
        'code' => 'GCG-DSH-0001', 'customer_id' => $customer->id,
        'device_owner' => 'Budi', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => now()->subMonths(2)->toDateString(), 'due_date' => now()->toDateString(),
        'status' => 'AKTIF', 'approval_status' => 'approved', 'clerk' => 'Rina',
    ]);

    // This month: an extension fee, and a redemption paying fee + late fee.
    $tx->events()->create(['type' => 'extended', 'event_date' => now()->toDateString(), 'title' => 'P', 'amount' => 150_000]);
    $tx->events()->create(['type' => 'redeemed', 'event_date' => now()->toDateString(), 'title' => 'T', 'amount' => 1_130_000]);
    // Last month: must not count.
    $tx->events()->create(['type' => 'extended', 'event_date' => now()->subMonth()->startOfMonth()->toDateString(), 'title' => 'P', 'amount' => 999_000]);

    $this->actingAs(User::factory()->owner()->create())
        ->get('/dashboard')
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('monthIncome', 150_000 + 130_000),
        );
});
