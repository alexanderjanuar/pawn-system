<?php

use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function lockCustomer(): Customer
{
    return Customer::create([
        'code' => 'PLG-020', 'name' => 'Doni', 'phone' => '0812',
        'address' => 'Jl. C', 'id_number' => '777', 'join_date' => '2026-07-01',
    ]);
}

function lockPayload(Customer $customer, array $overrides = []): array
{
    return array_merge([
        'code_mode' => 'auto',
        'customer_mode' => 'existing',
        'customer_code' => $customer->code,
        'device_name' => 'Oppo A54',
        'kelengkapan' => 'HP saja',
        'principal' => 500_000,
        'tenor_choice' => '15',
        'start_date' => '2026-07-20',
    ], $overrides);
}

test('a gadai can be created with a PIN lock', function () {
    $customer = lockCustomer();

    $this->actingAs(User::factory()->create())
        ->post('/gadai', lockPayload($customer, [
            'device_lock_type' => 'pin',
            'device_lock_value' => '1234',
        ]))
        ->assertRedirect();

    $tx = Transaction::first();
    expect($tx->device_lock_type)->toBe('pin')
        ->and($tx->device_lock_value)->toBe('1234');
});

test('a gadai can be created with a pattern lock', function () {
    $customer = lockCustomer();

    $this->actingAs(User::factory()->create())
        ->post('/gadai', lockPayload($customer, [
            'device_lock_type' => 'pattern',
            'device_lock_value' => '1-2-3-6-9',
        ]))
        ->assertRedirect();

    expect(Transaction::first()->device_lock_value)->toBe('1-2-3-6-9');
});

test('choosing a lock type requires a value', function () {
    $customer = lockCustomer();

    $this->actingAs(User::factory()->create())
        ->post('/gadai', lockPayload($customer, [
            'device_lock_type' => 'pin',
            'device_lock_value' => '',
        ]))
        ->assertSessionHasErrors('device_lock_value');
});

test('lock value is cleared when type is none', function () {
    $customer = lockCustomer();

    $this->actingAs(User::factory()->create())
        ->post('/gadai', lockPayload($customer, [
            'device_lock_type' => 'none',
            'device_lock_value' => 'leftover',
        ]))
        ->assertRedirect();

    expect(Transaction::first()->device_lock_value)->toBeNull();
});

test('the lock is visible on the authenticated detail page', function () {
    $customer = lockCustomer();
    $tx = Transaction::create([
        'code' => 'GCG-20260720-0020', 'customer_id' => $customer->id,
        'device_owner' => 'Doni', 'device_name' => 'Oppo', 'kelengkapan' => 'HP saja',
        'device_lock_type' => 'pin', 'device_lock_value' => '4321',
        'principal' => 500_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 50_000,
        'start_date' => '2026-07-20', 'due_date' => '2026-08-04', 'status' => 'AKTIF',
        'approval_status' => 'approved', 'clerk' => 'Rina',
    ]);

    $this->actingAs(User::factory()->create())
        ->get("/transaksi/{$tx->code}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('transaction.device.lockType', 'pin')
            ->where('transaction.device.lockValue', '4321'),
        );
});

test('the lock is never exposed on the public status page', function () {
    $customer = lockCustomer();
    Transaction::create([
        'code' => 'GCG-20260720-0021', 'customer_id' => $customer->id,
        'device_owner' => 'Doni', 'device_name' => 'Oppo', 'kelengkapan' => 'HP saja',
        'device_lock_type' => 'password', 'device_lock_value' => 'rahasia',
        'principal' => 500_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 50_000,
        'start_date' => '2026-07-20', 'due_date' => '2026-08-04', 'status' => 'AKTIF',
        'approval_status' => 'approved', 'clerk' => 'Rina',
    ]);

    // Both code and the matching phone are required to reveal the record.
    $this->get('/cek-status?kode=GCG-20260720-0021&hp=0812')
        ->assertInertia(fn (Assert $page) => $page
            ->where('result.device.name', 'Oppo')
            ->missing('result.device.lockValue')
            ->missing('result.device.lockType'),
        );
});
