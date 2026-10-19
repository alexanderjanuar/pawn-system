<?php

use App\Models\Customer;
use App\Models\Store;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * A sold forfeited/auctioned item brings its sale money into the drawer: on the
 * sale day it shows as "Jual Barang", and every later day starts higher.
 */
function saleCashItem(Store $store, string $status): Transaction
{
    $customer = Customer::firstOrCreate(
        ['code' => 'PLG-SALE'],
        ['name' => 'Budi', 'phone' => '081200000077', 'join_date' => '2026-01-01'],
    );

    return Transaction::create([
        'store_id' => $store->id,
        'code' => 'GCG-SALE-'.$status,
        'customer_id' => $customer->id,
        'device_owner' => 'Budi', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => now()->subDays(40)->toDateString(),
        'due_date' => now()->subDays(25)->toDateString(),
        'status' => $status, 'approval_status' => 'approved', 'clerk' => 'Rina',
    ]);
}

test('selling an item raises the cash on the sale day and every day after', function (string $status) {
    $store = Store::create(['code' => 'TK-001', 'nota_prefix' => 'GCG', 'name' => 'Toko A', 'active' => true]);
    $wallet = Wallet::defaultId();
    $owner = User::factory()->owner()->create();
    $this->actingAs($owner)->withSession(['active_store_id' => $store->id]);

    $saleDay = now()->subDay()->toDateString();
    $before = now()->subDays(3)->toDateString();

    // The drawer held 1jt three days ago.
    $this->post('/kas/saldo', ['amount' => 1_000_000, 'date' => $before, 'wallet_id' => $wallet])->assertRedirect();

    $item = saleCashItem($store, $status);
    $this->post("/transaksi/{$item->code}/sale", ['sale_value' => 800_000, 'date' => $saleDay, 'wallet_id' => $wallet])
        ->assertSessionHas('success');

    // Sale day: 800rb in as "Jual Barang", drawer goes from 1jt to 1,8jt.
    $this->get("/kas?from={$saleDay}&to={$saleDay}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('saldoAwal', 1_000_000)
            ->where('cashFlow.in.lelang', 800_000)
            ->where('cashFlow.in.total', 800_000)
            ->where('cashFlow.net', 800_000)
            ->where('cashFlow.entries.0.kind', 'lelang'),
        );

    // Next day opens with the sale money already in the drawer.
    $today = now()->toDateString();
    $this->get("/kas?from={$today}&to={$today}")
        ->assertInertia(fn (Assert $page) => $page->where('saldoAwal', 1_800_000));
})->with(['barang lelang' => 'LELANG', 'barang tidak diambil' => 'TIDAK_DIAMBIL']);

test('only marking an item for auction does not touch the cash', function () {
    $store = Store::create(['code' => 'TK-001', 'nota_prefix' => 'GCG', 'name' => 'Toko A', 'active' => true]);
    $this->actingAs(User::factory()->owner()->create())->withSession(['active_store_id' => $store->id]);

    $item = saleCashItem($store, 'AKTIF');
    $this->post("/transaksi/{$item->code}/lelang")->assertRedirect();

    $today = now()->toDateString();
    $this->get("/kas?from={$today}&to={$today}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('cashFlow.in.lelang', 0)
            ->where('cashFlow.in.total', 0),
        );
});

test('the dashboard lists auction items whose sale is not recorded, oldest first', function () {
    $store = Store::create(['code' => 'TK-001', 'nota_prefix' => 'GCG', 'name' => 'Toko A', 'active' => true]);
    $this->actingAs(User::factory()->owner()->create())->withSession(['active_store_id' => $store->id]);

    $older = saleCashItem($store, 'LELANG');
    $older->events()->create(['type' => 'auctioned', 'event_date' => now()->subDays(20), 'title' => 'Ditandai untuk lelang']);

    $newer = Transaction::create([
        ...$older->only(['store_id', 'customer_id', 'device_owner', 'kelengkapan', 'principal', 'tenor_days', 'fee_percent', 'fee', 'start_date', 'due_date', 'approval_status', 'clerk']),
        'code' => 'GCG-SALE-NEW', 'device_name' => 'HP baru', 'status' => 'LELANG',
    ]);
    $newer->events()->create(['type' => 'auctioned', 'event_date' => now()->subDays(3), 'title' => 'Ditandai untuk lelang']);

    // Already sold, and merely "Tidak Diambil": neither belongs on the list.
    $sold = saleCashItem($store, 'TIDAK_DIAMBIL');
    $this->post("/transaksi/{$sold->code}/sale", ['sale_value' => 700_000]);
    saleCashItem($store, 'AKTIF')->update(['code' => 'GCG-SALE-TD', 'status' => 'TIDAK_DIAMBIL']);

    $this->get('/dashboard')
        ->assertInertia(fn (Assert $page) => $page
            ->where('awaitingSale.count', 2)
            ->where('awaitingSale.principal', 2_000_000)
            ->where('awaitingSale.items.0.code', $older->code)
            ->where('awaitingSale.items.0.days', 20)
            ->where('awaitingSale.items.1.code', 'GCG-SALE-NEW'),
        );

    // Recording the sale takes it off the list.
    $this->post("/transaksi/{$older->code}/sale", ['sale_value' => 900_000])->assertSessionHas('success');

    $this->get('/dashboard')
        ->assertInertia(fn (Assert $page) => $page
            ->where('awaitingSale.count', 1)
            ->where('awaitingSale.items.0.code', 'GCG-SALE-NEW'),
        );
});

test('the sidebar badge counts unsold auction items, for management only', function () {
    $store = Store::create(['code' => 'TK-001', 'nota_prefix' => 'GCG', 'name' => 'Toko A', 'active' => true]);
    saleCashItem($store, 'LELANG');

    $this->actingAs(User::factory()->owner()->create())
        ->withSession(['active_store_id' => $store->id])
        ->get('/transaksi')
        ->assertInertia(fn (Assert $page) => $page->where('awaitingSaleCount', 1));

    $this->actingAs(User::factory()->petugas()->create(['store_id' => $store->id]))
        ->get('/transaksi')
        ->assertInertia(fn (Assert $page) => $page->where('awaitingSaleCount', 0));
});
