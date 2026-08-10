<?php

use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function itemTypeCustomer(): Customer
{
    return Customer::firstOrCreate(
        ['code' => 'PLG-070'],
        ['name' => 'Hadi', 'phone' => '0812', 'join_date' => '2026-07-01'],
    );
}

function itemPayload(Customer $customer, array $overrides = []): array
{
    return array_merge([
        'code_mode' => 'auto',
        'customer_mode' => 'existing',
        'customer_code' => $customer->code,
        'device_name' => 'Barang',
        'kelengkapan' => 'HP saja',
        'principal' => 1_000_000,
        'tenor_choice' => '15',
        'start_date' => '2026-08-10',
    ], $overrides);
}

test('a gadai defaults to the HP item type', function () {
    $customer = itemTypeCustomer();

    $this->actingAs(User::factory()->create())
        ->post('/gadai', itemPayload($customer))
        ->assertRedirect();

    expect(Transaction::first()->device_type)->toBe('hp');
});

test('a motor gadai stores motor fields and clears phone-only fields', function () {
    $customer = itemTypeCustomer();

    $this->actingAs(User::factory()->create())
        ->post('/gadai', itemPayload($customer, [
            'device_type' => 'motor',
            'device_name' => 'Honda Vario 125',
            'kelengkapan' => 'Motor + STNK + BPKB',
            'plat_nomor' => 'DD 1234 AB',
            'no_rangka' => 'MH1JF123',
            'no_mesin' => 'JF123456',
            'warna' => 'Merah',
            'tahun' => '2021',
            // Phone-only fields must be ignored for a motor.
            'device_ram' => '8 GB',
            'imei_1' => '123456',
            'device_lock_type' => 'pin',
            'device_lock_value' => '1234',
        ]))
        ->assertRedirect();

    $tx = Transaction::first();
    expect($tx->device_type)->toBe('motor')
        ->and($tx->plat_nomor)->toBe('DD 1234 AB')
        ->and($tx->no_rangka)->toBe('MH1JF123')
        ->and($tx->no_mesin)->toBe('JF123456')
        ->and($tx->tahun)->toBe('2021')
        ->and($tx->device_ram)->toBeNull()
        ->and($tx->imei_1)->toBeNull()
        ->and($tx->device_lock_type)->toBe('none');
});

test('a laptop gadai keeps specs but never stores IMEI or motor fields', function () {
    $customer = itemTypeCustomer();

    $this->actingAs(User::factory()->create())
        ->post('/gadai', itemPayload($customer, [
            'device_type' => 'laptop',
            'device_name' => 'Asus ROG Strix',
            'device_ram' => '16 GB',
            'device_storage' => '512 GB',
            'device_serial' => 'SN-ABC123',
            'imei_1' => '999999',
            'plat_nomor' => 'X 1',
        ]))
        ->assertRedirect();

    $tx = Transaction::first();
    expect($tx->device_type)->toBe('laptop')
        ->and($tx->device_ram)->toBe('16 GB')
        ->and($tx->device_serial)->toBe('SN-ABC123')
        ->and($tx->imei_1)->toBeNull()
        ->and($tx->plat_nomor)->toBeNull();
});

test('the detail page exposes item type and motor fields', function () {
    $customer = itemTypeCustomer();
    $tx = Transaction::create([
        'code' => 'GCG-20260810-0070', 'customer_id' => $customer->id,
        'device_owner' => 'Hadi', 'device_type' => 'motor', 'device_name' => 'Honda Vario',
        'kelengkapan' => 'Motor + STNK', 'plat_nomor' => 'DD 1 AB', 'no_rangka' => 'RNG-9',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => '2026-08-10', 'due_date' => '2026-08-25', 'status' => 'AKTIF',
        'approval_status' => 'approved', 'clerk' => 'Rina',
    ]);

    $this->actingAs(User::factory()->create())
        ->get("/transaksi/{$tx->code}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('transaction.device.type', 'motor')
            ->where('transaction.device.platNomor', 'DD 1 AB')
            ->where('transaction.device.noRangka', 'RNG-9'),
        );
});
