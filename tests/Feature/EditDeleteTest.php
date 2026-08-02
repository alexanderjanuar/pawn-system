<?php

use App\Models\Customer;
use App\Models\Transaction;
use App\Models\TransactionEvent;
use App\Models\User;
use Database\Seeders\GadaiSeeder;

test('a transaction can be updated (fee + due date recompute)', function () {
    $this->seed(GadaiSeeder::class);
    $user = User::factory()->create();
    $tx = Transaction::query()->where('status', 'AKTIF')->firstOrFail();

    $this->actingAs($user)->put("/transaksi/{$tx->code}", [
        'customer_mode' => 'existing',
        'customer_code' => $tx->customer->code,
        'device_name' => 'iPhone 16 Pro',
        'kelengkapan' => 'HP + Box + Charger',
        'status' => 'PERPANJANG',
        'principal' => 5_000_000,
        'tenor_choice' => '30',
        'start_date' => '2026-07-20',
    ])->assertRedirect(route('transaksi.show', $tx));

    $tx->refresh();

    expect($tx->device_name)->toBe('iPhone 16 Pro')
        ->and($tx->status)->toBe('PERPANJANG')
        ->and($tx->principal)->toBe(5_000_000)
        ->and($tx->fee)->toBe(750_000) // 30d -> 15%
        ->and($tx->due_date->toDateString())->toBe('2026-08-19');
});

test('a transaction can be deleted with its events', function () {
    $this->seed(GadaiSeeder::class);
    $user = User::factory()->create();
    $tx = Transaction::query()->firstOrFail();
    $code = $tx->code;
    $id = $tx->id;

    $this->actingAs($user)->delete("/transaksi/{$tx->code}")
        ->assertRedirect(route('transaksi.index'));

    expect(Transaction::where('code', $code)->exists())->toBeFalse()
        ->and(TransactionEvent::where('transaction_id', $id)->count())->toBe(0);
});

test('a customer can be updated', function () {
    $user = User::factory()->create();
    $customer = Customer::create([
        'code' => 'PLG-001', 'name' => 'Lama', 'phone' => '081',
        'join_date' => '2026-07-01',
    ]);

    $this->actingAs($user)->put("/pelanggan/{$customer->code}", [
        'name' => 'Nama Baru',
        'phone' => '0899-1111',
        'address' => 'Jl. Edit',
        'id_number' => '3509zzzz',
        'notes' => 'Pelanggan VIP',
    ])->assertRedirect(route('pelanggan.show', $customer));

    $customer->refresh();
    expect($customer->name)->toBe('Nama Baru')
        ->and($customer->notes)->toBe('Pelanggan VIP');
});

test('a customer with transactions cannot be deleted', function () {
    $this->seed(GadaiSeeder::class);
    $user = User::factory()->create();
    $customer = Customer::query()->whereHas('transactions')->firstOrFail();

    $this->actingAs($user)->delete("/pelanggan/{$customer->code}")
        ->assertSessionHas('error');

    expect(Customer::whereKey($customer->id)->exists())->toBeTrue();
});

test('a customer without transactions can be deleted', function () {
    $user = User::factory()->create();
    $customer = Customer::create([
        'code' => 'PLG-099', 'name' => 'Kosong', 'phone' => '080',
        'join_date' => '2026-07-01',
    ]);

    $this->actingAs($user)->delete("/pelanggan/{$customer->code}")
        ->assertRedirect(route('pelanggan.index'));

    expect(Customer::whereKey($customer->id)->exists())->toBeFalse();
});
