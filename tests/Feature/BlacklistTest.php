<?php

use App\Models\Customer;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function blacklistCustomer(): Customer
{
    return Customer::create([
        'code' => 'PLG-001', 'name' => 'Budi', 'phone' => '0812-3344-5566',
        'address' => 'Jl. A', 'id_number' => '350900', 'join_date' => '2026-07-01',
    ]);
}

test('a customer can be blacklisted with a reason', function () {
    $customer = blacklistCustomer();

    $this->actingAs(User::factory()->create())
        ->put("/pelanggan/{$customer->code}/blacklist", ['reason' => 'Sering telat'])
        ->assertRedirect();

    $customer->refresh();
    expect($customer->blacklisted_at)->not->toBeNull()
        ->and($customer->blacklist_reason)->toBe('Sering telat');
});

test('blacklist requires a reason', function () {
    $customer = blacklistCustomer();

    $this->actingAs(User::factory()->create())
        ->put("/pelanggan/{$customer->code}/blacklist", [])
        ->assertSessionHasErrors('reason');

    expect($customer->refresh()->blacklisted_at)->toBeNull();
});

test('a customer can be un-blacklisted', function () {
    $customer = blacklistCustomer();
    $customer->update(['blacklisted_at' => now(), 'blacklist_reason' => 'Bermasalah']);

    $this->actingAs(User::factory()->create())
        ->delete("/pelanggan/{$customer->code}/blacklist")
        ->assertRedirect();

    expect($customer->refresh()->blacklisted_at)->toBeNull();
});

test('the customer detail exposes blacklist status', function () {
    $customer = blacklistCustomer();
    $customer->update([
        'blacklisted_at' => now(),
        'blacklist_reason' => 'Identitas palsu',
    ]);

    $this->actingAs(User::factory()->create())
        ->get("/pelanggan/{$customer->code}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('customer.blacklisted', true)
            ->where('customer.blacklistReason', 'Identitas palsu'),
        );
});

test('guests cannot blacklist a customer', function () {
    $customer = blacklistCustomer();

    $this->put("/pelanggan/{$customer->code}/blacklist", ['reason' => 'x'])
        ->assertRedirect(route('login'));
});
