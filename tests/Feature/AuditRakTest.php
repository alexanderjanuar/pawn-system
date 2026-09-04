<?php

use App\Models\Customer;
use App\Models\Rak;
use App\Models\Store;
use App\Models\Transaction;

function auditRakStore(): Store
{
    return Store::create(['code' => 'TK-001', 'nota_prefix' => 'GCG', 'name' => 'Toko A', 'active' => true]);
}

function auditRakTransaction(Store $store, Customer $customer, string $code, ?int $rakId, array $overrides = []): Transaction
{
    return Transaction::create(array_merge([
        'store_id' => $store->id, 'rak_id' => $rakId, 'code' => $code,
        'customer_id' => $customer->id, 'device_owner' => 'Budi', 'device_name' => 'iPhone',
        'kelengkapan' => 'HP saja', 'principal' => 1_000_000, 'tenor_days' => 15,
        'fee_percent' => 10, 'fee' => 100_000, 'start_date' => '2026-07-20',
        'due_date' => '2026-08-04', 'status' => 'AKTIF', 'clerk' => 'Rina',
    ], $overrides));
}

test('the audit lists held phones that sit on no rack', function () {
    $store = auditRakStore();
    $customer = Customer::create(['code' => 'PLG-001', 'name' => 'Budi', 'phone' => '081', 'join_date' => '2026-07-01']);
    $rak = Rak::create(['store_id' => $store->id, 'name' => 'Rak 1', 'capacity' => 10, 'active' => true]);

    auditRakTransaction($store, $customer, 'GCG-1', $rak->id);
    auditRakTransaction($store, $customer, 'GCG-2', null);

    $this->artisan('rak:audit')
        ->expectsOutputToContain('BARANG DIPEGANG TAPI BELUM PUNYA RAK: 1')
        ->expectsOutputToContain('GCG-2')
        ->expectsOutputToContain('sudah di rak: 1 · belum di rak: 1')
        ->assertSuccessful();
});

test('the audit flags a rack holding more than its capacity', function () {
    $store = auditRakStore();
    $customer = Customer::create(['code' => 'PLG-001', 'name' => 'Budi', 'phone' => '081', 'join_date' => '2026-07-01']);
    $rak = Rak::create(['store_id' => $store->id, 'name' => 'Rak 1', 'capacity' => 1, 'active' => true]);

    auditRakTransaction($store, $customer, 'GCG-1', $rak->id);
    auditRakTransaction($store, $customer, 'GCG-2', $rak->id);

    $this->artisan('rak:audit')
        ->expectsOutputToContain('RAK MELEBIHI KAPASITAS: 1')
        ->assertSuccessful();
});

test('a redeemed phone no longer counts towards its rack', function () {
    $store = auditRakStore();
    $customer = Customer::create(['code' => 'PLG-001', 'name' => 'Budi', 'phone' => '081', 'join_date' => '2026-07-01']);
    $rak = Rak::create(['store_id' => $store->id, 'name' => 'Rak 1', 'capacity' => 10, 'active' => true]);

    auditRakTransaction($store, $customer, 'GCG-1', $rak->id);
    auditRakTransaction($store, $customer, 'GCG-2', $rak->id, ['status' => 'DIAMBIL']);

    $this->artisan('rak:audit')
        ->expectsOutputToContain('Barang yang masih dipegang toko: 1')
        ->expectsOutputToContain('SISA DATA RAK PADA BARANG YANG SUDAH KELUAR: 1')
        ->assertSuccessful();
});

test('a phone parked on another store rack is reported', function () {
    $store = auditRakStore();
    $other = Store::create(['code' => 'TK-002', 'nota_prefix' => 'GCB', 'name' => 'Toko B', 'active' => true]);
    $customer = Customer::create(['code' => 'PLG-001', 'name' => 'Budi', 'phone' => '081', 'join_date' => '2026-07-01']);
    $otherRak = Rak::create(['store_id' => $other->id, 'name' => 'Rak 1', 'capacity' => 10, 'active' => true]);

    auditRakTransaction($store, $customer, 'GCG-1', $otherRak->id);

    $this->artisan('rak:audit')
        ->expectsOutputToContain('RAK DARI TOKO YANG BERBEDA: 1')
        ->assertSuccessful();
});
