<?php

use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

test('guests cannot create a gadai', function () {
    $this->post('/gadai', [])->assertRedirect(route('login'));
});

test('a gadai can be created for an existing customer with photos', function () {
    Storage::fake('public');
    $user = User::factory()->create(['name' => 'Rina']);
    $customer = Customer::create([
        'code' => 'PLG-001',
        'name' => 'Budi Santoso',
        'phone' => '0812-3344-5566',
        'address' => 'Jl. Serayu',
        'id_number' => '3509xxxx',
        'join_date' => '2026-07-01',
    ]);

    $response = $this->actingAs($user)->post('/gadai', [
        'customer_mode' => 'existing',
        'customer_code' => $customer->code,
        'device_owner' => '',
        'device_name' => 'iPhone 15',
        'device_ram' => '8 GB',
        'device_storage' => '256 GB',
        'device_serial' => '359001112223334',
        'kelengkapan' => 'HP + Box',
        'principal' => 1_000_000,
        'tenor_choice' => '15',
        'start_date' => '2026-07-20',
        'notes' => 'Mulus',
        'photos' => [
            UploadedFile::fake()->image('a.jpg'),
            UploadedFile::fake()->image('b.jpg'),
        ],
        'photo_labels' => ['Depan', 'Belakang'],
        'ktp' => UploadedFile::fake()->image('ktp.jpg'),
        'cetak' => 0,
    ]);

    $tx = Transaction::first();

    expect($tx)->not->toBeNull()
        ->and($tx->fee)->toBe(100_000) // 10% of 1jt
        ->and($tx->tenor_days)->toBe(15)
        ->and($tx->status)->toBe('AKTIF')
        ->and($tx->code)->toBe('GCG-20260720-0001')
        ->and($tx->customer_id)->toBe($customer->id)
        ->and($tx->device_owner)->toBe('Budi Santoso') // fell back to customer name
        ->and($tx->photos)->toHaveCount(2)
        ->and($tx->photos[0]['label'])->toBe('Depan')
        ->and($tx->photos[1]['label'])->toBe('Belakang')
        ->and($tx->due_date->toDateString())->toBe('2026-08-04')
        ->and($tx->events()->where('type', 'created')->count())->toBe(1);

    $response->assertRedirect(route('transaksi.show', $tx));
    Storage::disk('public')->assertExists($tx->photos[0]['path']);
    Storage::disk('public')->assertExists($tx->ktp_path);
});

test('a gadai creates a new customer when needed', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post('/gadai', [
        'customer_mode' => 'new',
        'name' => 'Pelanggan Baru',
        'phone' => '0812-0000-0000',
        'address' => 'Jl. Baru',
        'id_number' => '3509yyyy',
        'device_name' => 'Xiaomi 14',
        'kelengkapan' => 'HP saja',
        'principal' => 2_000_000,
        'tenor_choice' => '30',
        'start_date' => '2026-07-20',
    ])->assertRedirect();

    $customer = Customer::where('phone', '0812-0000-0000')->first();
    expect($customer)->not->toBeNull()
        ->and($customer->code)->toStartWith('PLG-');

    $tx = Transaction::first();
    expect($tx->fee)->toBe(300_000) // 15% of 2jt
        ->and($tx->fee_percent)->toBe(15);
});

test('custom tenor computes its own fee', function () {
    $user = User::factory()->create();
    $customer = Customer::create([
        'code' => 'PLG-001', 'name' => 'A', 'phone' => '081',
        'join_date' => '2026-07-01',
    ]);

    $this->actingAs($user)->post('/gadai', [
        'customer_mode' => 'existing',
        'customer_code' => $customer->code,
        'device_name' => 'HP',
        'kelengkapan' => 'HP saja',
        'principal' => 3_000_000,
        'tenor_choice' => 'custom',
        'custom_days' => 20,
        'custom_percent' => 12,
        'start_date' => '2026-07-02',
    ])->assertRedirect();

    $tx = Transaction::first();
    expect($tx->fee)->toBe(360_000)
        ->and($tx->tenor_days)->toBe(20)
        ->and($tx->due_date->toDateString())->toBe('2026-07-22');
});

test('a custom fee can be entered as a nominal rupiah amount', function () {
    $user = User::factory()->create();
    $customer = Customer::create([
        'code' => 'PLG-001', 'name' => 'A', 'phone' => '081',
        'join_date' => '2026-07-01',
    ]);

    $this->actingAs($user)->post('/gadai', [
        'customer_mode' => 'existing',
        'customer_code' => $customer->code,
        'device_name' => 'HP',
        'kelengkapan' => 'HP saja',
        'principal' => 500_000,
        'tenor_choice' => 'custom',
        'custom_days' => 20,
        'fee_mode' => 'nominal',
        'custom_fee' => 75_000,
        'start_date' => '2026-07-20',
    ])->assertRedirect();

    $tx = Transaction::first();
    expect($tx->fee)->toBe(75_000) // exact nominal
        ->and($tx->fee_percent)->toBe(15) // derived: 75k / 500k
        ->and($tx->tenor_days)->toBe(20);
});

test('nota number uses the GCG-date-sequence format and increments per day', function () {
    $user = User::factory()->create();
    $customer = Customer::create([
        'code' => 'PLG-001', 'name' => 'A', 'phone' => '081',
        'join_date' => '2026-07-01',
    ]);

    $create = fn (string $date) => $this->actingAs($user)->post('/gadai', [
        'customer_mode' => 'existing',
        'customer_code' => $customer->code,
        'device_name' => 'HP',
        'kelengkapan' => 'HP saja',
        'principal' => 1_000_000,
        'tenor_choice' => '15',
        'start_date' => $date,
    ]);

    $create('2026-07-29');
    $create('2026-07-29');
    $create('2026-07-30');

    expect(Transaction::orderBy('id')->pluck('code')->all())->toBe([
        'GCG-20260729-0001',
        'GCG-20260729-0002',
        'GCG-20260730-0001',
    ]);

    // Sequence follows the highest existing number, not a row count, so
    // deleting a row never reissues a used nota number.
    Transaction::where('code', 'GCG-20260729-0001')->delete();
    $create('2026-07-29');

    expect(Transaction::orderByDesc('id')->first()->code)->toBe('GCG-20260729-0003');
});

test('a manual nota number is used as-is when provided', function () {
    $user = User::factory()->create();
    $customer = Customer::create([
        'code' => 'PLG-001', 'name' => 'A', 'phone' => '081',
        'join_date' => '2026-07-01',
    ]);

    $this->actingAs($user)->post('/gadai', [
        'code_mode' => 'manual',
        'code' => 'GCG-KHUSUS-777',
        'customer_mode' => 'existing',
        'customer_code' => $customer->code,
        'device_name' => 'HP',
        'kelengkapan' => 'HP saja',
        'principal' => 1_000_000,
        'tenor_choice' => '15',
        'start_date' => '2026-07-20',
    ])->assertRedirect();

    expect(Transaction::first()->code)->toBe('GCG-KHUSUS-777');
});

test('a manual nota number must be unique', function () {
    $user = User::factory()->create();
    $customer = Customer::create([
        'code' => 'PLG-001', 'name' => 'A', 'phone' => '081',
        'join_date' => '2026-07-01',
    ]);
    Transaction::create([
        'code' => 'GCG-20260720-0001', 'customer_id' => $customer->id,
        'device_owner' => 'A', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => '2026-07-20', 'due_date' => '2026-08-04', 'status' => 'AKTIF', 'clerk' => 'Rina',
    ]);

    $this->actingAs($user)->post('/gadai', [
        'code_mode' => 'manual',
        'code' => 'GCG-20260720-0001',
        'customer_mode' => 'existing',
        'customer_code' => $customer->code,
        'device_name' => 'HP',
        'kelengkapan' => 'HP saja',
        'principal' => 1_000_000,
        'tenor_choice' => '15',
        'start_date' => '2026-07-20',
    ])->assertSessionHasErrors('code');

    expect(Transaction::count())->toBe(1);
});

test('auto mode ignores any submitted code and generates one', function () {
    $user = User::factory()->create();
    $customer = Customer::create([
        'code' => 'PLG-001', 'name' => 'A', 'phone' => '081',
        'join_date' => '2026-07-01',
    ]);

    $this->actingAs($user)->post('/gadai', [
        'code_mode' => 'auto',
        'code' => 'GCG-DIABAIKAN-1',
        'customer_mode' => 'existing',
        'customer_code' => $customer->code,
        'device_name' => 'HP',
        'kelengkapan' => 'HP saja',
        'principal' => 1_000_000,
        'tenor_choice' => '15',
        'start_date' => '2026-07-20',
    ])->assertRedirect();

    expect(Transaction::first()->code)->toBe('GCG-20260720-0001');
});

test('the detail page exposes an absolute QR url to itself', function () {
    $user = User::factory()->create();
    $customer = Customer::create([
        'code' => 'PLG-001', 'name' => 'A', 'phone' => '081',
        'join_date' => '2026-07-01',
    ]);
    $tx = Transaction::create([
        'code' => 'GCG-20260720-0001', 'customer_id' => $customer->id,
        'device_owner' => 'A', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => '2026-07-20', 'due_date' => '2026-08-04', 'status' => 'AKTIF', 'clerk' => 'Rina',
    ]);

    $this->actingAs($user)
        ->get("/transaksi/{$tx->code}")
        ->assertInertia(fn (Assert $page) => $page
            ->component('transaksi/show')
            ->where('transaction.detailUrl', route('transaksi.show', $tx)),
        );
});

test('the petugas is taken from the form, not the logged-in account', function () {
    $user = User::factory()->create(['name' => 'Akun Toko']);
    $customer = Customer::create([
        'code' => 'PLG-001', 'name' => 'A', 'phone' => '081',
        'join_date' => '2026-07-01',
    ]);

    $this->actingAs($user)->post('/gadai', [
        'customer_mode' => 'existing',
        'customer_code' => $customer->code,
        'device_name' => 'HP',
        'kelengkapan' => 'HP saja',
        'clerk' => 'Rina',
        'principal' => 1_000_000,
        'tenor_choice' => '15',
        'start_date' => '2026-07-20',
    ])->assertRedirect();

    expect(Transaction::first()->clerk)->toBe('Rina');
});

test('a running transaction can be redeemed and taken', function () {
    $user = User::factory()->create();
    $customer = Customer::create([
        'code' => 'PLG-001', 'name' => 'A', 'phone' => '081', 'join_date' => '2026-07-01',
    ]);
    $tx = Transaction::create([
        'code' => 'GCG-20260720-0001', 'customer_id' => $customer->id,
        'device_owner' => 'A', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => '2026-07-20', 'due_date' => '2026-08-04', 'status' => 'AKTIF',
        'approval_status' => 'approved', 'clerk' => 'Rina',
    ]);

    $this->actingAs($user)->post("/transaksi/{$tx->code}/tebus")->assertRedirect();

    $tx->refresh();
    expect($tx->status)->toBe('DIAMBIL')
        ->and($tx->events()->where('type', 'redeemed')->count())->toBe(1);
});

test('a redeemed transaction cannot be redeemed again', function () {
    $user = User::factory()->create();
    $customer = Customer::create([
        'code' => 'PLG-001', 'name' => 'A', 'phone' => '081', 'join_date' => '2026-07-01',
    ]);
    $tx = Transaction::create([
        'code' => 'GCG-20260720-0001', 'customer_id' => $customer->id,
        'device_owner' => 'A', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => '2026-07-20', 'due_date' => '2026-08-04', 'status' => 'DIAMBIL',
        'approval_status' => 'approved', 'clerk' => 'Rina',
    ]);

    $this->actingAs($user)->post("/transaksi/{$tx->code}/tebus")->assertRedirect();

    expect($tx->events()->where('type', 'redeemed')->count())->toBe(0);
});

test('a gadai requires a device name and principal', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post('/gadai', [
        'customer_mode' => 'new',
        'name' => 'X',
        'phone' => '08',
        'kelengkapan' => 'HP saja',
        'tenor_choice' => '15',
        'start_date' => '2026-07-20',
    ])->assertSessionHasErrors(['device_name', 'principal']);

    expect(Transaction::count())->toBe(0);
});
