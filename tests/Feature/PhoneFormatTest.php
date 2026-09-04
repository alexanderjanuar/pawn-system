<?php

use App\Models\Customer;
use App\Models\Piutang;
use App\Models\Store;
use App\Models\User;

test('a customer phone is stored in one canonical shape however it is typed', function () {
    $customer = Customer::create([
        'code' => 'PLG-001', 'name' => 'Budi', 'phone' => '0838-3620-2747',
        'join_date' => '2026-07-01',
    ]);

    expect($customer->fresh()->phone)->toBe('083836202747');

    $customer->update(['phone' => '+62 812 3344 5566']);

    expect($customer->fresh()->phone)->toBe('081233445566');
});

test('a blank phone stays blank rather than becoming null', function () {
    $customer = Customer::create([
        'code' => 'PLG-002', 'name' => 'Andi', 'phone' => '',
        'join_date' => '2026-07-01',
    ]);

    expect($customer->fresh()->phone)->toBe('');
});

test('a piutang debtor phone is normalised too', function () {
    $store = Store::create(['code' => 'TK-001', 'nota_prefix' => 'GCG', 'name' => 'Toko A', 'active' => true]);

    $this->actingAs(User::factory()->petugas()->create(['store_id' => $store->id]))
        ->post('/piutang', [
            'debtor_name' => 'Rina',
            'debtor_phone' => '0812 5372 1672',
            'device_name' => 'Redmi 13C',
            'price' => 1_800_000,
            'date' => '2026-07-25',
        ])->assertRedirect();

    expect(Piutang::first()->debtor_phone)->toBe('081253721672');
});

test('the same person typed two ways lands on the same number', function () {
    $a = Customer::create([
        'code' => 'PLG-010', 'name' => 'Sari', 'phone' => '0812-5372-1672',
        'join_date' => '2026-07-01',
    ]);
    $b = Customer::create([
        'code' => 'PLG-011', 'name' => 'Sari (2)', 'phone' => '+6281253721672',
        'join_date' => '2026-07-01',
    ]);

    expect($a->fresh()->phone)->toBe($b->fresh()->phone);
});
