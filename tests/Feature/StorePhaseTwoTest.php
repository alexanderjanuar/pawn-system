<?php

use App\Models\ActivityLog;
use App\Models\Clerk;
use App\Models\Customer;
use App\Models\Store;
use App\Models\Transaction;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function p2Store(string $code, string $prefix, string $name): Store
{
    return Store::create(['code' => $code, 'nota_prefix' => $prefix, 'name' => $name, 'active' => true]);
}

function p2Customer(): Customer
{
    return Customer::create([
        'code' => 'PLG-001', 'name' => 'Budi', 'phone' => '081', 'join_date' => '2026-07-01',
    ]);
}

function p2GadaiPayload(Customer $customer): array
{
    return [
        'customer_mode' => 'existing', 'customer_code' => $customer->code,
        'device_name' => 'HP', 'kelengkapan' => 'HP saja', 'clerk' => 'Rina',
        'principal' => 1_000_000, 'tenor_choice' => '15', 'start_date' => '2026-07-20',
    ];
}

// --- Kelola Toko CRUD ---------------------------------------------------------

test('owner can create a store', function () {
    $this->actingAs(User::factory()->owner()->create())
        ->post('/pengaturan/toko', [
            'name' => 'Gulam Cell III', 'code' => 'TK-002',
            'nota_prefix' => 'GCC', 'address' => 'Jl. A', 'phone' => '081',
        ])
        ->assertRedirect();

    $store = Store::where('code', 'TK-002')->first();
    expect($store)->not->toBeNull()
        ->and($store->nota_prefix)->toBe('GCC')
        ->and($store->active)->toBeTrue();
});

test('store code and nota prefix must be unique', function () {
    p2Store('TK-001', 'GCG', 'A');
    $owner = User::factory()->owner()->create();

    $this->actingAs($owner)
        ->post('/pengaturan/toko', ['name' => 'B', 'code' => 'TK-001', 'nota_prefix' => 'GCC'])
        ->assertSessionHasErrors('code');

    $this->actingAs($owner)
        ->post('/pengaturan/toko', ['name' => 'B', 'code' => 'TK-002', 'nota_prefix' => 'GCG'])
        ->assertSessionHasErrors('nota_prefix');
});

test('a store with transactions cannot be deleted but an empty one can', function () {
    $withData = p2Store('TK-001', 'GCG', 'A');
    $empty = p2Store('TK-002', 'GCC', 'B');
    $customer = p2Customer();
    $customer->transactions()->create([
        'store_id' => $withData->id, 'code' => 'GCG-20260720-0001', 'device_owner' => 'A',
        'device_name' => 'HP', 'kelengkapan' => 'HP saja', 'principal' => 1_000_000,
        'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000, 'start_date' => '2026-07-20',
        'due_date' => '2026-08-04', 'status' => 'AKTIF', 'clerk' => 'Rina',
    ]);

    $owner = User::factory()->owner()->create();

    $this->actingAs($owner)->delete("/pengaturan/toko/{$withData->id}")->assertRedirect();
    expect(Store::find($withData->id))->not->toBeNull();

    $this->actingAs($owner)->delete("/pengaturan/toko/{$empty->id}")->assertRedirect();
    expect(Store::find($empty->id))->toBeNull();
});

test('petugas cannot manage stores', function () {
    $store = p2Store('TK-001', 'GCG', 'A');
    $staff = User::factory()->petugas()->create(['store_id' => $store->id]);

    $this->actingAs($staff)->get('/pengaturan/toko')->assertForbidden();
    $this->actingAs($staff)->post('/pengaturan/toko', ['name' => 'X', 'code' => 'TK-9', 'nota_prefix' => 'ZZ'])->assertForbidden();
});

// --- Per-store petugas roster -------------------------------------------------

test('adding a petugas assigns it to the active store', function () {
    $a = p2Store('TK-001', 'GCG', 'A');

    $this->actingAs(User::factory()->owner()->create())
        ->withSession(['active_store_id' => $a->id])
        ->post('/pengaturan/petugas', ['name' => 'Rina'])
        ->assertRedirect();

    expect(Clerk::where('name', 'Rina')->first()->store_id)->toBe($a->id);
});

test('petugas names can repeat across stores', function () {
    $a = p2Store('TK-001', 'GCG', 'A');
    $b = p2Store('TK-002', 'GCC', 'B');
    Clerk::create(['store_id' => $a->id, 'name' => 'Rina', 'active' => true]);

    $this->actingAs(User::factory()->owner()->create())
        ->withSession(['active_store_id' => $b->id])
        ->post('/pengaturan/petugas', ['name' => 'Rina'])
        ->assertRedirect();

    expect(Clerk::where('name', 'Rina')->count())->toBe(2);
});

test('management must pick a store to add a petugas', function () {
    p2Store('TK-001', 'GCG', 'A');

    $this->actingAs(User::factory()->owner()->create())
        ->post('/pengaturan/petugas', ['name' => 'Rina']);

    expect(Clerk::count())->toBe(0);
});

// --- Account store assignment -------------------------------------------------

test('a petugas account requires a store once stores exist', function () {
    p2Store('TK-001', 'GCG', 'A');

    $this->actingAs(User::factory()->owner()->create())
        ->post('/pengaturan/akun', [
            'name' => 'Sari', 'email' => 'sari@x.test', 'role' => 'petugas', 'password' => 'rahasia12345',
        ])
        ->assertSessionHasErrors('store_id');
});

test('a petugas account is assigned to the chosen store, management stays null', function () {
    $a = p2Store('TK-001', 'GCG', 'A');
    $owner = User::factory()->owner()->create();

    $this->actingAs($owner)->post('/pengaturan/akun', [
        'name' => 'Sari', 'email' => 'sari@x.test', 'role' => 'petugas',
        'store_id' => $a->id, 'password' => 'rahasia12345',
    ])->assertRedirect();

    $this->actingAs($owner)->post('/pengaturan/akun', [
        'name' => 'Bos', 'email' => 'bos@x.test', 'role' => 'owner',
        'store_id' => $a->id, 'password' => 'rahasia12345',
    ])->assertRedirect();

    expect(User::where('email', 'sari@x.test')->first()->store_id)->toBe($a->id)
        ->and(User::where('email', 'bos@x.test')->first()->store_id)->toBeNull();
});

// --- Nota per store -----------------------------------------------------------

test('nota numbers use each store prefix and do not collide', function () {
    $a = p2Store('TK-001', 'GCG', 'A');
    $b = p2Store('TK-002', 'GCC', 'B');
    $customer = p2Customer();
    Clerk::create(['store_id' => $a->id, 'name' => 'Rina', 'active' => true]);
    Clerk::create(['store_id' => $b->id, 'name' => 'Rina', 'active' => true]);
    $owner = User::factory()->owner()->create();

    $this->actingAs($owner)->withSession(['active_store_id' => $a->id])
        ->post('/gadai', p2GadaiPayload($customer))->assertRedirect();
    $this->actingAs($owner)->withSession(['active_store_id' => $b->id])
        ->post('/gadai', p2GadaiPayload($customer))->assertRedirect();

    $codes = Transaction::orderBy('id')->pluck('code')->all();
    expect($codes[0])->toStartWith('GCG-20260720-')
        ->and($codes[1])->toStartWith('GCC-20260720-');
});

// --- Activity log scoping -----------------------------------------------------

test('the activity log is scoped to the active store', function () {
    $a = p2Store('TK-001', 'GCG', 'A');
    $b = p2Store('TK-002', 'GCC', 'B');
    ActivityLog::create(['store_id' => $a->id, 'actor' => 'X', 'action' => 'created', 'subject_type' => 'transaction', 'subject_code' => 'GCG-1', 'description' => 'a']);
    ActivityLog::create(['store_id' => $b->id, 'actor' => 'X', 'action' => 'created', 'subject_type' => 'transaction', 'subject_code' => 'GCC-1', 'description' => 'b']);

    $this->actingAs(User::factory()->owner()->create())
        ->withSession(['active_store_id' => $a->id])
        ->get('/aktivitas')
        ->assertInertia(fn (Assert $page) => $page->has('activities', 1));
});
