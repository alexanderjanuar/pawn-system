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
