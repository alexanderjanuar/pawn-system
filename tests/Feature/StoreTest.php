<?php

use App\Models\Clerk;
use App\Models\Customer;
use App\Models\Store;
use App\Models\Transaction;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function storeTx(Store $store, Customer $customer, string $code): Transaction
{
    return $customer->transactions()->create([
        'store_id' => $store->id,
        'code' => $code, 'device_owner' => 'A', 'device_name' => 'HP',
        'kelengkapan' => 'HP saja', 'principal' => 1_000_000, 'tenor_days' => 15,
        'fee_percent' => 10, 'fee' => 100_000, 'start_date' => '2026-07-20',
        'due_date' => '2026-08-04', 'status' => 'AKTIF', 'clerk' => 'Rina',
    ]);
}

function storeGadaiPayload(Customer $customer, array $overrides = []): array
{
    return array_merge([
        'customer_mode' => 'existing', 'customer_code' => $customer->code,
        'device_name' => 'HP', 'kelengkapan' => 'HP saja', 'clerk' => 'Rina',
        'principal' => 1_000_000, 'tenor_choice' => '15', 'start_date' => '2026-07-20',
    ], $overrides);
}

test('a petugas only sees transactions from their own store', function () {
    $a = Store::create(['code' => 'TK-001', 'name' => 'Toko A', 'active' => true]);
    $b = Store::create(['code' => 'TK-002', 'name' => 'Toko B', 'active' => true]);
    $customer = Customer::create([
        'code' => 'PLG-001', 'name' => 'Budi', 'phone' => '081', 'join_date' => '2026-07-01',
    ]);
    storeTx($a, $customer, 'GCG-A-0001');
    storeTx($b, $customer, 'GCG-B-0001');

    $petugas = User::factory()->petugas()->create(['store_id' => $a->id]);

    $this->actingAs($petugas)->get('/transaksi')
        ->assertInertia(fn (Assert $page) => $page
            ->component('transaksi/index')
            ->has('transactions', 1)
            ->where('transactions.0.id', 'GCG-A-0001'),
        );
});

test('management sees all stores by default and can scope by switching', function () {
    $a = Store::create(['code' => 'TK-001', 'name' => 'Toko A', 'active' => true]);
    $b = Store::create(['code' => 'TK-002', 'name' => 'Toko B', 'active' => true]);
    $customer = Customer::create([
        'code' => 'PLG-001', 'name' => 'Budi', 'phone' => '081', 'join_date' => '2026-07-01',
    ]);
    storeTx($a, $customer, 'GCG-A-0001');
    storeTx($b, $customer, 'GCG-B-0001');

    $owner = User::factory()->owner()->create();

    $this->actingAs($owner)->get('/transaksi')
        ->assertInertia(fn (Assert $page) => $page->has('transactions', 2));

    $this->actingAs($owner)->withSession(['active_store_id' => $a->id])->get('/transaksi')
        ->assertInertia(fn (Assert $page) => $page
            ->has('transactions', 1)
            ->where('transactions.0.id', 'GCG-A-0001'),
        );
});

test('a management user can switch the active store', function () {
    $a = Store::create(['code' => 'TK-001', 'name' => 'Toko A', 'active' => true]);

    $this->actingAs(User::factory()->owner()->create())
        ->post('/toko/switch', ['store' => $a->id])
        ->assertRedirect()
        ->assertSessionHas('active_store_id', $a->id);
});

test('the active store shared props reflect the switched store', function () {
    $a = Store::create(['code' => 'TK-001', 'name' => 'Toko A', 'active' => true]);
    Store::create(['code' => 'TK-002', 'name' => 'Toko B', 'active' => true]);
    $owner = User::factory()->owner()->create();

    // Default: all stores.
    $this->actingAs($owner)->get('/dashboard')
        ->assertInertia(fn (Assert $page) => $page
            ->where('activeStore', 'all')
            ->where('activeStoreName', 'Semua Toko')
            ->has('stores', 2),
        );

    // After choosing a store, the shared props reflect it.
    $this->actingAs($owner)->withSession(['active_store_id' => $a->id])->get('/dashboard')
        ->assertInertia(fn (Assert $page) => $page
            ->where('activeStore', $a->id)
            ->where('activeStoreName', 'Toko A'),
        );
});

test('a petugas shared props are locked to their store', function () {
    $a = Store::create(['code' => 'TK-001', 'name' => 'Toko A', 'active' => true]);
    $petugas = User::factory()->petugas()->create(['store_id' => $a->id]);

    $this->actingAs($petugas)->get('/transaksi')
        ->assertInertia(fn (Assert $page) => $page
            ->where('activeStore', $a->id)
            ->where('activeStoreName', 'Toko A')
            ->has('stores', 0),
        );
});

test('switching to all clears the store filter', function () {
    $a = Store::create(['code' => 'TK-001', 'name' => 'Toko A', 'active' => true]);

    $this->actingAs(User::factory()->owner()->create())
        ->withSession(['active_store_id' => $a->id])
        ->post('/toko/switch', ['store' => 'all'])
        ->assertRedirect()
        ->assertSessionMissing('active_store_id');
});

test('a petugas cannot switch stores', function () {
    $a = Store::create(['code' => 'TK-001', 'name' => 'Toko A', 'active' => true]);

    $this->actingAs(User::factory()->petugas()->create(['store_id' => $a->id]))
        ->post('/toko/switch', ['store' => $a->id])
        ->assertForbidden();
});

test('a new transaction is tagged with the petugas store', function () {
    $a = Store::create(['code' => 'TK-001', 'name' => 'Toko A', 'active' => true]);
    $customer = Customer::create([
        'code' => 'PLG-001', 'name' => 'Budi', 'phone' => '081', 'join_date' => '2026-07-01',
    ]);
    Clerk::factory()->create(['name' => 'Rina', 'store_id' => $a->id]);
    $petugas = User::factory()->petugas()->create(['store_id' => $a->id]);

    $this->actingAs($petugas)->post('/gadai', storeGadaiPayload($customer))->assertRedirect();

    expect(Transaction::first()->store_id)->toBe($a->id);
});

test('management creates a transaction for the active store', function () {
    $a = Store::create(['code' => 'TK-001', 'name' => 'Toko A', 'active' => true]);
    $b = Store::create(['code' => 'TK-002', 'name' => 'Toko B', 'active' => true]);
    $customer = Customer::create([
        'code' => 'PLG-001', 'name' => 'Budi', 'phone' => '081', 'join_date' => '2026-07-01',
    ]);
    Clerk::factory()->create(['name' => 'Rina', 'store_id' => $b->id]);

    $this->actingAs(User::factory()->owner()->create())
        ->withSession(['active_store_id' => $b->id])
        ->post('/gadai', storeGadaiPayload($customer))
        ->assertRedirect();

    expect(Transaction::first()->store_id)->toBe($b->id);
});

test('management viewing all stores must pick a store before creating', function () {
    Store::create(['code' => 'TK-001', 'name' => 'Toko A', 'active' => true]);
    $customer = Customer::create([
        'code' => 'PLG-001', 'name' => 'Budi', 'phone' => '081', 'join_date' => '2026-07-01',
    ]);
    $owner = User::factory()->owner()->create();

    $this->actingAs($owner)->get('/gadai/baru')->assertRedirect(route('transaksi.index'));

    $this->actingAs($owner)->post('/gadai', storeGadaiPayload($customer))->assertRedirect();
    expect(Transaction::count())->toBe(0);
});

test('the gadai form lists only the active store petugas', function () {
    $a = Store::create(['code' => 'TK-001', 'name' => 'Toko A', 'active' => true]);
    $b = Store::create(['code' => 'TK-002', 'name' => 'Toko B', 'active' => true]);
    Clerk::factory()->create(['name' => 'Rina', 'store_id' => $a->id]);
    Clerk::factory()->create(['name' => 'Dedi', 'store_id' => $b->id]);
    $petugas = User::factory()->petugas()->create(['store_id' => $a->id]);

    $this->actingAs($petugas)->get('/gadai/baru')
        ->assertInertia(fn (Assert $page) => $page
            ->component('transaksi/create')
            ->where('petugasList', ['Rina']),
        );
});
