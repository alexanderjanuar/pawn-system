<?php

use App\Models\Customer;
use App\Models\Rak;
use App\Models\Store;
use App\Models\Transaction;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function rakStore(): Store
{
    return Store::create(['code' => 'TK-001', 'nota_prefix' => 'GCG', 'name' => 'Toko A', 'active' => true]);
}

function rakCustomer(): Customer
{
    return Customer::create([
        'code' => 'PLG-001', 'name' => 'Budi', 'phone' => '081', 'join_date' => '2026-07-01',
    ]);
}

function rakGadaiPayload(Customer $customer, array $overrides = []): array
{
    return array_merge([
        'customer_mode' => 'existing', 'customer_code' => $customer->code,
        'device_name' => 'HP', 'kelengkapan' => 'HP saja', 'clerk' => 'Rina',
        'principal' => 1_000_000, 'tenor_choice' => '15', 'start_date' => '2026-07-20',
    ], $overrides);
}

test('the rak page lists racks with occupancy and contents', function () {
    $store = rakStore();
    $rak = Rak::create(['store_id' => $store->id, 'name' => 'Rak A', 'capacity' => 10, 'active' => true]);
    $other = Rak::create(['store_id' => $store->id, 'name' => 'Rak B', 'capacity' => 10, 'active' => true]);
    $customer = rakCustomer();

    // One held phone on Rak A, one redeemed (should not count).
    $customer->transactions()->create([
        'store_id' => $store->id, 'rak_id' => $rak->id, 'code' => 'GCG-1', 'device_owner' => 'A',
        'device_name' => 'iPhone', 'kelengkapan' => 'HP saja', 'principal' => 1_000_000,
        'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000, 'start_date' => '2026-07-20',
        'due_date' => '2026-08-04', 'status' => 'AKTIF', 'clerk' => 'Rina',
    ]);
    $customer->transactions()->create([
        'store_id' => $store->id, 'rak_id' => $rak->id, 'code' => 'GCG-2', 'device_owner' => 'A',
        'device_name' => 'Redmi', 'kelengkapan' => 'HP saja', 'principal' => 500_000,
        'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 50_000, 'start_date' => '2026-07-20',
        'due_date' => '2026-08-04', 'status' => 'DIAMBIL', 'clerk' => 'Rina',
    ]);

    $this->actingAs(User::factory()->owner()->create())
        ->withSession(['active_store_id' => $store->id])
        ->get('/rak')
        ->assertInertia(fn (Assert $page) => $page
            ->component('rak/index')
            ->where('canManage', true)
            ->has('racks', 2)
            ->where('racks.0.name', 'Rak A')
            ->where('racks.0.count', 1)
            ->where('racks.0.items.0.id', 'GCG-1')
            ->where('racks.1.count', 0),
        );
});

test('owner can create, rename, and delete an empty rak', function () {
    $store = rakStore();
    $owner = User::factory()->owner()->create();

    $this->actingAs($owner)->withSession(['active_store_id' => $store->id])
        ->post('/rak', ['name' => 'Rak A', 'capacity' => 8])->assertRedirect();
    $rak = Rak::where('name', 'Rak A')->first();
    expect($rak->store_id)->toBe($store->id)->and($rak->capacity)->toBe(8);

    $this->actingAs($owner)->put("/rak/{$rak->id}", ['name' => 'Rak A1'])->assertRedirect();
    expect($rak->fresh()->name)->toBe('Rak A1');

    $this->actingAs($owner)->delete("/rak/{$rak->id}")->assertRedirect();
    expect(Rak::find($rak->id))->toBeNull();
});

test('rak names must be unique per store but may repeat across stores', function () {
    $a = rakStore();
    $b = Store::create(['code' => 'TK-002', 'nota_prefix' => 'GCC', 'name' => 'Toko B', 'active' => true]);
    Rak::create(['store_id' => $a->id, 'name' => 'Rak A', 'active' => true]);
    $owner = User::factory()->owner()->create();

    $this->actingAs($owner)->withSession(['active_store_id' => $a->id])
        ->post('/rak', ['name' => 'Rak A'])->assertSessionHasErrors('name');

    $this->actingAs($owner)->withSession(['active_store_id' => $b->id])
        ->post('/rak', ['name' => 'Rak A'])->assertRedirect();

    expect(Rak::where('name', 'Rak A')->count())->toBe(2);
});

test('a rak holding phones cannot be deleted', function () {
    $store = rakStore();
    $rak = Rak::create(['store_id' => $store->id, 'name' => 'Rak A', 'active' => true]);
    rakCustomer()->transactions()->create([
        'store_id' => $store->id, 'rak_id' => $rak->id, 'code' => 'GCG-1', 'device_owner' => 'A',
        'device_name' => 'HP', 'kelengkapan' => 'HP saja', 'principal' => 1_000_000,
        'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000, 'start_date' => '2026-07-20',
        'due_date' => '2026-08-04', 'status' => 'AKTIF', 'clerk' => 'Rina',
    ]);

    $this->actingAs(User::factory()->owner()->create())
        ->delete("/rak/{$rak->id}");

    expect(Rak::find($rak->id))->not->toBeNull();
});

test('a gadai stores the chosen rak', function () {
    $store = rakStore();
    $rak = Rak::create(['store_id' => $store->id, 'name' => 'Rak A', 'active' => true]);
    $petugas = User::factory()->petugas()->create(['store_id' => $store->id]);
    $customer = rakCustomer();

    $this->actingAs($petugas)
        ->post('/gadai', rakGadaiPayload($customer, ['rak_id' => $rak->id]))
        ->assertRedirect();

    expect(Transaction::first()->rak_id)->toBe($rak->id);
});

test('the gadai form only offers the active store racks', function () {
    $a = rakStore();
    $b = Store::create(['code' => 'TK-002', 'nota_prefix' => 'GCC', 'name' => 'Toko B', 'active' => true]);
    Rak::create(['store_id' => $a->id, 'name' => 'Rak A', 'active' => true]);
    Rak::create(['store_id' => $b->id, 'name' => 'Rak B', 'active' => true]);
    $petugas = User::factory()->petugas()->create(['store_id' => $a->id]);

    $this->actingAs($petugas)->get('/gadai/baru')
        ->assertInertia(fn (Assert $page) => $page
            ->component('transaksi/create')
            ->has('rakList', 1)
            ->where('rakList.0.name', 'Rak A'),
        );
});

test('petugas cannot manage racks', function () {
    $store = rakStore();
    $rak = Rak::create(['store_id' => $store->id, 'name' => 'Rak A', 'active' => true]);
    $staff = User::factory()->petugas()->create(['store_id' => $store->id]);

    $this->actingAs($staff)->get('/rak')->assertOk(); // can view
    $this->actingAs($staff)->post('/rak', ['name' => 'X'])->assertForbidden();
    $this->actingAs($staff)->put("/rak/{$rak->id}", ['name' => 'Y'])->assertForbidden();
    $this->actingAs($staff)->delete("/rak/{$rak->id}")->assertForbidden();
});
