<?php

use App\Models\Customer;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function settingCustomer(): Customer
{
    return Customer::create([
        'code' => 'PLG-001', 'name' => 'Budi', 'phone' => '0812',
        'address' => 'Jl. A', 'id_number' => '350900', 'join_date' => '2026-07-01',
    ]);
}

function settingGadai(Customer $customer, int $principal): array
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

test('the pengaturan page exposes the current threshold', function () {
    Setting::put('approval_threshold', 7_500_000);

    $this->actingAs(User::factory()->owner()->create())
        ->get('/pengaturan/biaya')
        ->assertInertia(fn (Assert $page) => $page
            ->component('pengaturan/biaya')
            ->where('approvalThreshold', 7_500_000),
        );
});

test('owner can update the approval threshold', function () {
    $this->actingAs(User::factory()->owner()->create())
        ->put('/pengaturan/biaya', ['approval_threshold' => 20_000_000])
        ->assertRedirect();

    expect((int) Setting::get('approval_threshold'))->toBe(20_000_000);
});

test('petugas cannot update the approval threshold', function () {
    $this->actingAs(User::factory()->petugas()->create())
        ->put('/pengaturan/biaya', ['approval_threshold' => 1])
        ->assertForbidden();

    expect(Setting::get('approval_threshold'))->toBeNull();
});

test('a raised threshold auto-approves a loan that would otherwise be pending', function () {
    Setting::put('approval_threshold', 20_000_000);
    $customer = settingCustomer();

    $this->actingAs(User::factory()->petugas()->create())
        ->post('/gadai', settingGadai($customer, 10_000_000))
        ->assertRedirect();

    expect(Transaction::first()->approval_status)->toBe('approved');
});

test('a lowered threshold requires approval for a smaller loan', function () {
    Setting::put('approval_threshold', 1_000_000);
    $customer = settingCustomer();

    $this->actingAs(User::factory()->petugas()->create())
        ->post('/gadai', settingGadai($customer, 2_000_000))
        ->assertRedirect();

    expect(Transaction::first()->approval_status)->toBe('pending');
});
