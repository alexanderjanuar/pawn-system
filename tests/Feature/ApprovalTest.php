<?php

use App\Models\ActivityLog;
use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function approvalCustomer(): Customer
{
    return Customer::create([
        'code' => 'PLG-001', 'name' => 'Budi', 'phone' => '0812',
        'address' => 'Jl. A', 'id_number' => '350900', 'join_date' => '2026-07-01',
    ]);
}

function pendingTransaction(Customer $customer): Transaction
{
    return Transaction::create([
        'code' => 'GCG-20260720-0001', 'customer_id' => $customer->id,
        'device_owner' => 'Budi', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 10_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 1_000_000,
        'start_date' => '2026-07-20', 'due_date' => '2026-08-04', 'status' => 'AKTIF',
        'approval_status' => 'pending', 'clerk' => 'Rina',
    ]);
}

function gadaiPayload(Customer $customer, int $principal): array
{
    return [
        'code_mode' => 'auto',
        'customer_mode' => 'existing',
        'customer_code' => $customer->code,
        'device_name' => 'iPhone 15',
        'kelengkapan' => 'HP saja',
        'principal' => $principal,
        'tenor_choice' => '15',
        'start_date' => '2026-07-20',
    ];
}

test('petugas creating a loan above the threshold needs approval', function () {
    $customer = approvalCustomer();

    $this->actingAs(User::factory()->petugas()->create())
        ->post('/gadai', gadaiPayload($customer, 10_000_000))
        ->assertRedirect();

    $tx = Transaction::first();
    expect($tx->approval_status)->toBe('pending')
        ->and($tx->approved_at)->toBeNull();
});

test('petugas creating a loan at or below the threshold is auto-approved', function () {
    $customer = approvalCustomer();

    $this->actingAs(User::factory()->petugas()->create())
        ->post('/gadai', gadaiPayload($customer, 5_000_000))
        ->assertRedirect();

    expect(Transaction::first()->approval_status)->toBe('approved');
});

test('owner creating a large loan self-approves', function () {
    $customer = approvalCustomer();

    $this->actingAs(User::factory()->owner()->create(['name' => 'Bos']))
        ->post('/gadai', gadaiPayload($customer, 20_000_000))
        ->assertRedirect();

    $tx = Transaction::first();
    expect($tx->approval_status)->toBe('approved')
        ->and($tx->approved_by)->toBe('Bos');
});

test('owner can approve a pending loan and it is logged', function () {
    $customer = approvalCustomer();
    $tx = pendingTransaction($customer);

    $this->actingAs(User::factory()->owner()->create(['name' => 'Bos']))
        ->post("/transaksi/{$tx->code}/approve")
        ->assertRedirect();

    $tx->refresh();
    expect($tx->approval_status)->toBe('approved')
        ->and($tx->approved_by)->toBe('Bos')
        ->and($tx->approved_at)->not->toBeNull()
        ->and(ActivityLog::where('description', 'Menyetujui pencairan')->exists())->toBeTrue();
});

test('owner can reject a pending loan', function () {
    $customer = approvalCustomer();
    $tx = pendingTransaction($customer);

    $this->actingAs(User::factory()->admin()->create())
        ->post("/transaksi/{$tx->code}/reject")
        ->assertRedirect();

    expect($tx->refresh()->approval_status)->toBe('rejected');
});

test('petugas cannot approve or reject', function () {
    $customer = approvalCustomer();
    $tx = pendingTransaction($customer);
    $petugas = User::factory()->petugas()->create();

    $this->actingAs($petugas)->post("/transaksi/{$tx->code}/approve")->assertForbidden();
    $this->actingAs($petugas)->post("/transaksi/{$tx->code}/reject")->assertForbidden();

    expect($tx->refresh()->approval_status)->toBe('pending');
});

test('the dashboard exposes the pending-approval queue', function () {
    $customer = approvalCustomer();
    pendingTransaction($customer);

    $this->actingAs(User::factory()->owner()->create())
        ->get('/dashboard')
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->has('pendingApprovals', 1)
            ->where('pendingApprovals.0.approvalStatus', 'pending'),
        );
});
