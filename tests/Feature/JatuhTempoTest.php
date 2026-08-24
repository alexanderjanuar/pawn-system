<?php

use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function jatuhTempoTx(string $status, string $code): Transaction
{
    $customer = Customer::create([
        'code' => 'PLG-'.$code, 'name' => 'Cust '.$code, 'phone' => '0812',
        'join_date' => '2026-06-01',
    ]);

    return Transaction::create([
        'code' => $code, 'customer_id' => $customer->id,
        'device_owner' => 'Cust', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 500_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 50_000,
        'start_date' => '2026-06-15', 'due_date' => '2026-06-30', 'status' => $status,
        'approval_status' => 'approved', 'clerk' => 'Atul',
    ]);
}

test('the jatuh tempo page excludes items already marked Tidak Diambil', function () {
    jatuhTempoTx('AKTIF', 'GCG-20260615-0001');
    jatuhTempoTx('TIDAK_DIAMBIL', 'GCG-20260615-0002');

    $this->actingAs(User::factory()->create())
        ->get('/jatuh-tempo')
        ->assertInertia(fn (Assert $page) => $page
            ->has('transactions', 1) // only the AKTIF one
            ->where('transactions.0.id', 'GCG-20260615-0001')
        );
});

test('the overdue badge count ignores Tidak Diambil items', function () {
    jatuhTempoTx('AKTIF', 'GCG-20260615-0003');
    jatuhTempoTx('PERPANJANG', 'GCG-20260615-0004');
    jatuhTempoTx('TIDAK_DIAMBIL', 'GCG-20260615-0005');

    $this->actingAs(User::factory()->create())
        ->get('/jatuh-tempo')
        ->assertInertia(fn (Assert $page) => $page->where('overdueCount', 2));
});
