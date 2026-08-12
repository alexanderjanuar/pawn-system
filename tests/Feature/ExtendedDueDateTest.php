<?php

use App\Models\ActivityLog;
use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;

function dueDateCustomer(): Customer
{
    return Customer::firstOrCreate(
        ['code' => 'PLG-080'],
        ['name' => 'Fadli', 'phone' => '0812', 'join_date' => '2026-07-01'],
    );
}

function editPayload(Customer $customer, array $overrides = []): array
{
    return array_merge([
        'customer_mode' => 'existing',
        'customer_code' => $customer->code,
        'device_name' => 'VIVO Y21D',
        'kelengkapan' => 'HP + Box + Charger',
        'status' => 'PERPANJANG',
        'principal' => 800_000,
        'tenor_choice' => '30',
        'start_date' => '2026-07-11',
    ], $overrides);
}

test('editing an extended loan keeps its extended due date', function () {
    $customer = dueDateCustomer();
    // Extended once to 2026-09-09 (30-day period from the 2026-08-10 due date).
    $tx = Transaction::create([
        'code' => 'GCG-20260711-0496', 'customer_id' => $customer->id,
        'device_owner' => 'Fadli', 'device_name' => 'VIVO Y21D', 'kelengkapan' => 'HP + Box + Charger',
        'principal' => 800_000, 'tenor_days' => 30, 'fee_percent' => 15, 'fee' => 120_000,
        'start_date' => '2026-07-11', 'due_date' => '2026-09-09', 'status' => 'PERPANJANG',
        'approval_status' => 'approved', 'clerk' => 'Atul', 'extensions' => 1,
    ]);

    // A routine edit (rename the device) must not touch the schedule.
    $this->actingAs(User::factory()->create())
        ->put("/transaksi/{$tx->code}", editPayload($customer, ['device_name' => 'VIVO Y21D 2021']))
        ->assertRedirect();

    expect($tx->refresh()->due_date->toDateString())->toBe('2026-09-09');
});

test('editing a non-extended loan still recomputes its due date', function () {
    $customer = dueDateCustomer();
    $tx = Transaction::create([
        'code' => 'GCG-20260711-0497', 'customer_id' => $customer->id,
        'device_owner' => 'Fadli', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 800_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 80_000,
        'start_date' => '2026-07-11', 'due_date' => '2026-07-26', 'status' => 'AKTIF',
        'approval_status' => 'approved', 'clerk' => 'Atul', 'extensions' => 0,
    ]);

    // Switching to a 30-day tenor should move the due date to start + 30 days.
    $this->actingAs(User::factory()->create())
        ->put("/transaksi/{$tx->code}", editPayload($customer, [
            'device_name' => 'HP', 'kelengkapan' => 'HP saja', 'status' => 'AKTIF',
        ]))
        ->assertRedirect();

    expect($tx->refresh()->due_date->toDateString())->toBe('2026-08-10');
});

test('the repair command restores a reverted extended due date', function () {
    $customer = dueDateCustomer();
    // Corrupted: due date reverted to the pre-extension value.
    $tx = Transaction::create([
        'code' => 'GCG-20260711-0496', 'customer_id' => $customer->id,
        'device_owner' => 'Fadli', 'device_name' => 'VIVO Y21D', 'kelengkapan' => 'HP + Box + Charger',
        'principal' => 800_000, 'tenor_days' => 30, 'fee_percent' => 15, 'fee' => 120_000,
        'start_date' => '2026-07-11', 'due_date' => '2026-08-10', 'status' => 'PERPANJANG',
        'approval_status' => 'approved', 'clerk' => 'Atul', 'extensions' => 1,
    ]);
    ActivityLog::create([
        'actor' => 'Atul', 'action' => 'updated', 'subject_type' => 'transaction',
        'subject_code' => $tx->code, 'subject_label' => 'Fadli',
        'description' => 'Memperpanjang s/d 2026-09-09',
    ]);

    $this->artisan('gadai:repair-due-dates')->assertSuccessful();

    expect($tx->refresh()->due_date->toDateString())->toBe('2026-09-09');
});

test('the repair command leaves healthy extended loans untouched', function () {
    $customer = dueDateCustomer();
    $tx = Transaction::create([
        'code' => 'GCG-20260711-0498', 'customer_id' => $customer->id,
        'device_owner' => 'Fadli', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 800_000, 'tenor_days' => 30, 'fee_percent' => 15, 'fee' => 120_000,
        'start_date' => '2026-07-11', 'due_date' => '2026-09-09', 'status' => 'PERPANJANG',
        'approval_status' => 'approved', 'clerk' => 'Atul', 'extensions' => 1,
    ]);
    ActivityLog::create([
        'actor' => 'Atul', 'action' => 'updated', 'subject_type' => 'transaction',
        'subject_code' => $tx->code, 'subject_label' => 'Fadli',
        'description' => 'Memperpanjang s/d 2026-09-09',
    ]);

    $this->artisan('gadai:repair-due-dates')->assertSuccessful();

    expect($tx->refresh()->due_date->toDateString())->toBe('2026-09-09');
});
