<?php

use App\Models\ActivityLog;
use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function auditCustomer(): Customer
{
    return Customer::create([
        'code' => 'PLG-001', 'name' => 'Budi', 'phone' => '0812',
        'address' => 'Jl. A', 'id_number' => '350900', 'join_date' => '2026-07-01',
    ]);
}

function auditTransaction(Customer $customer): Transaction
{
    return Transaction::create([
        'code' => 'GCG-20260720-0001', 'customer_id' => $customer->id,
        'device_owner' => 'Budi', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => '2026-07-20', 'due_date' => '2026-08-04', 'status' => 'AKTIF', 'clerk' => 'Rina',
    ]);
}

test('creating a transaction records an audit entry', function () {
    $user = User::factory()->create(['name' => 'Rina']);
    $customer = auditCustomer();

    $this->actingAs($user)->post('/gadai', [
        'code_mode' => 'auto',
        'customer_mode' => 'existing',
        'customer_code' => $customer->code,
        'device_name' => 'iPhone 15',
        'kelengkapan' => 'HP saja',
        'principal' => 1_000_000,
        'tenor_choice' => '15',
        'start_date' => '2026-07-20',
    ])->assertRedirect();

    $log = ActivityLog::where('action', 'created')
        ->where('subject_type', 'transaction')
        ->first();

    expect($log)->not->toBeNull()
        ->and($log->actor)->toBe('Rina')
        ->and($log->subject_code)->toBe('GCG-20260720-0001')
        ->and($log->description)->toBe('Membuat transaksi');
});

test('editing a transaction records the changed fields', function () {
    $user = User::factory()->create(['name' => 'Manager']);
    $customer = auditCustomer();
    $tx = auditTransaction($customer);

    $this->actingAs($user)->put("/transaksi/{$tx->code}", [
        'customer_mode' => 'existing',
        'customer_code' => $customer->code,
        'device_name' => 'HP',
        'kelengkapan' => 'HP saja',
        'status' => 'AKTIF',
        'principal' => 2_000_000, // changed nominal
        'tenor_choice' => '15',
        'start_date' => '2026-07-20',
        'change_reason' => 'Koreksi nominal',
    ])->assertRedirect();

    $log = ActivityLog::where('action', 'updated')->first();

    expect($log)->not->toBeNull()
        ->and($log->actor)->toBe('Manager');

    $fields = collect($log->changes)->pluck('field');
    expect($fields)->toContain('Dana titipan')
        ->and($fields)->toContain('Biaya titipan');

    $dana = collect($log->changes)->firstWhere('field', 'Dana titipan');
    expect($dana['from'])->toBe('Rp 1.000.000')
        ->and($dana['to'])->toBe('Rp 2.000.000');
});

test('an unchanged edit records no audit entry', function () {
    $user = User::factory()->create();
    $customer = auditCustomer();
    $tx = auditTransaction($customer);

    $this->actingAs($user)->put("/transaksi/{$tx->code}", [
        'customer_mode' => 'existing',
        'customer_code' => $customer->code,
        'device_name' => 'HP',
        'kelengkapan' => 'HP saja',
        'status' => 'AKTIF',
        'principal' => 1_000_000,
        'tenor_choice' => '15',
        'start_date' => '2026-07-20',
    ])->assertRedirect();

    expect(ActivityLog::where('action', 'updated')->count())->toBe(0);
});

test('deleting a transaction leaves a surviving audit entry', function () {
    $user = User::factory()->create(['name' => 'Owner']);
    $customer = auditCustomer();
    $tx = auditTransaction($customer);

    $this->actingAs($user)->delete("/transaksi/{$tx->code}")->assertRedirect();

    $log = ActivityLog::where('action', 'deleted')->first();

    expect($log)->not->toBeNull()
        ->and($log->actor)->toBe('Owner')
        ->and($log->subject_code)->toBe('GCG-20260720-0001')
        ->and(Transaction::count())->toBe(0);
});

test('transaction detail history includes edits with time and changes', function () {
    $user = User::factory()->create(['name' => 'Manager']);
    $customer = auditCustomer();
    $tx = auditTransaction($customer);

    $this->actingAs($user)->put("/transaksi/{$tx->code}", [
        'customer_mode' => 'existing',
        'customer_code' => $customer->code,
        'device_name' => 'HP',
        'kelengkapan' => 'HP saja',
        'status' => 'AKTIF',
        'principal' => 2_000_000,
        'tenor_choice' => '15',
        'start_date' => '2026-07-20',
        'change_reason' => 'Koreksi nominal',
    ])->assertRedirect();

    $this->actingAs($user)
        ->get("/transaksi/{$tx->code}")
        ->assertInertia(fn (Assert $page) => $page
            ->component('transaksi/show')
            ->where('history.0.kind', 'updated')
            ->where('history.0.by', 'Manager')
            ->where('history.0.changes.0.field', 'Dana titipan')
            ->has('history.0.time'),
        );
});

test('the aktivitas page lists activities', function () {
    $user = User::factory()->owner()->create();
    ActivityLog::record('created', 'transaction', 'GCG-20260720-0001', 'Budi', 'Membuat transaksi');

    $this->actingAs($user)
        ->get('/aktivitas')
        ->assertInertia(fn (Assert $page) => $page
            ->component('aktivitas')
            ->has('activities', 1)
            ->where('activities.0.action', 'created'),
        );
});

test('guests cannot access aktivitas', function () {
    $this->get('/aktivitas')->assertRedirect(route('login'));
});
