<?php

use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;

function imeiTx(string $code, ?string $imei1, ?string $imei2 = null): Transaction
{
    $customer = Customer::firstOrCreate(
        ['code' => 'PLG-'.substr(md5($code), 0, 3)],
        [
            'name' => 'Pelanggan '.$code,
            'phone' => '0812-'.substr($code, -4),
            'join_date' => '2026-07-01',
        ],
    );

    return Transaction::create([
        'code' => $code, 'customer_id' => $customer->id, 'device_owner' => 'A',
        'device_name' => 'iPhone', 'kelengkapan' => 'HP saja',
        'imei_1' => $imei1, 'imei_2' => $imei2,
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => '2026-07-20', 'due_date' => '2026-08-04', 'status' => 'AKTIF', 'clerk' => 'Rina',
    ]);
}

test('cek-imei finds a prior pawn with the same IMEI', function () {
    imeiTx('GCG-20260720-0001', '351111111111111');

    $this->actingAs(User::factory()->create())
        ->getJson('/gadai/cek-imei?imei=351111111111111')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.code', 'GCG-20260720-0001');
});

test('cek-imei ignores a device that was already redeemed (DIAMBIL)', function () {
    $tx = imeiTx('GCG-20260720-0009', '351111111111111');
    $tx->update(['status' => 'DIAMBIL']);

    $this->actingAs(User::factory()->create())
        ->getJson('/gadai/cek-imei?imei=351111111111111')
        ->assertOk()
        ->assertJsonCount(0);
});

test('cek-imei ignores a device already sold at auction', function () {
    $tx = imeiTx('GCG-20260720-0010', '353333333333333');
    $tx->update(['status' => 'LELANG', 'sale_value' => 800_000, 'sold_at' => now()]);

    $this->actingAs(User::factory()->create())
        ->getJson('/gadai/cek-imei?imei=353333333333333')
        ->assertOk()
        ->assertJsonCount(0);
});

test('cek-imei also matches the second IMEI slot', function () {
    imeiTx('GCG-20260720-0002', '351111111111111', '352222222222222');

    $this->actingAs(User::factory()->create())
        ->getJson('/gadai/cek-imei?imei=352222222222222')
        ->assertOk()
        ->assertJsonCount(1);
});

test('cek-imei is empty for unknown or too-short IMEI', function () {
    imeiTx('GCG-20260720-0003', '351111111111111');
    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson('/gadai/cek-imei?imei=999999999999999')
        ->assertOk()
        ->assertJsonCount(0);

    $this->actingAs($user)
        ->getJson('/gadai/cek-imei?imei=123')
        ->assertOk()
        ->assertJsonCount(0);
});

test('cek-imei can exclude the current transaction in edit mode', function () {
    imeiTx('GCG-20260720-0004', '351111111111111');

    $this->actingAs(User::factory()->create())
        ->getJson('/gadai/cek-imei?imei=351111111111111&exclude=GCG-20260720-0004')
        ->assertOk()
        ->assertJsonCount(0);
});

test('creating a gadai saves both IMEI numbers', function () {
    $user = User::factory()->create();
    $customer = Customer::create([
        'code' => 'PLG-001', 'name' => 'A', 'phone' => '081',
        'join_date' => '2026-07-01',
    ]);

    $this->actingAs($user)->post('/gadai', [
        'customer_mode' => 'existing',
        'customer_code' => $customer->code,
        'device_name' => 'iPhone',
        'kelengkapan' => 'HP saja',
        'imei_1' => '351111111111111',
        'imei_2' => '352222222222222',
        'principal' => 1_000_000,
        'tenor_choice' => '15',
        'start_date' => '2026-07-20',
    ])->assertRedirect();

    $tx = Transaction::first();
    expect($tx->imei_1)->toBe('351111111111111')
        ->and($tx->imei_2)->toBe('352222222222222');
});

test('guests cannot use cek-imei', function () {
    $this->getJson('/gadai/cek-imei?imei=351111111111111')->assertUnauthorized();
});
