<?php

use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function notaCustomer(): Customer
{
    return Customer::create([
        'code' => 'PLG-030', 'name' => 'Eka', 'phone' => '0812',
        'address' => 'Jl. D', 'id_number' => '999', 'join_date' => '2026-07-01',
    ]);
}

test('the nota entry date stays the original date for a non-extended pawn', function () {
    $customer = notaCustomer();
    $tx = Transaction::create([
        'code' => 'GCG-20260720-0030', 'customer_id' => $customer->id,
        'device_owner' => 'Eka', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => '2026-07-20', 'due_date' => '2026-08-04', 'status' => 'AKTIF',
        'approval_status' => 'approved', 'clerk' => 'Rina', 'extensions' => 0,
    ]);

    $this->actingAs(User::factory()->create())
        ->get("/transaksi/{$tx->code}/nota")
        ->assertInertia(fn (Assert $page) => $page
            ->where('transaction.notaStartDate', '2026-07-20')
            ->where('transaction.dueDate', '2026-08-04'),
        );
});

test('the nota entry date becomes the current period start for an extended pawn', function () {
    $customer = notaCustomer();
    // Extended once: current 30-day period runs 2026-08-04 -> 2026-09-03.
    $tx = Transaction::create([
        'code' => 'GCG-20260720-0031', 'customer_id' => $customer->id,
        'device_owner' => 'Eka', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 30, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => '2026-07-20', 'due_date' => '2026-09-03', 'status' => 'PERPANJANG',
        'approval_status' => 'approved', 'clerk' => 'Rina', 'extensions' => 1,
    ]);

    $this->actingAs(User::factory()->create())
        ->get("/transaksi/{$tx->code}/nota")
        ->assertInertia(fn (Assert $page) => $page
            ->where('transaction.notaStartDate', '2026-08-04')
            ->where('transaction.dueDate', '2026-09-03'),
        );
});
