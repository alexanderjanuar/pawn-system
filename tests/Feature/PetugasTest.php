<?php

use App\Models\Clerk;
use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('the petugas page lists roster entries with transaction counts', function () {
    $rina = Clerk::factory()->create(['name' => 'Rina']);
    Clerk::factory()->inactive()->create(['name' => 'Dedi']);

    $customer = Customer::create([
        'code' => 'PLG-001', 'name' => 'A', 'phone' => '081', 'join_date' => '2026-07-01',
    ]);
    $customer->transactions()->create([
        'code' => 'GCG-20260720-0001', 'device_owner' => 'A', 'device_name' => 'HP',
        'kelengkapan' => 'HP saja', 'principal' => 1_000_000, 'tenor_days' => 15,
        'fee_percent' => 10, 'fee' => 100_000, 'start_date' => '2026-07-20',
        'due_date' => '2026-08-04', 'status' => 'AKTIF', 'clerk' => 'Rina',
    ]);

    $this->actingAs(User::factory()->owner()->create())
        ->get('/pengaturan/petugas')
        ->assertInertia(fn (Assert $page) => $page
            ->component('pengaturan/petugas')
            ->has('petugas', 2)
            ->where('petugas.0.name', 'Rina') // active listed first
            ->where('petugas.0.active', true)
            ->where('petugas.0.transactionCount', 1)
            ->where('petugas.1.name', 'Dedi')
            ->where('petugas.1.active', false),
        );
});

test('owner can add a petugas', function () {
    $this->actingAs(User::factory()->owner()->create())
        ->post('/pengaturan/petugas', ['name' => 'Sari'])
        ->assertRedirect();

    expect(Clerk::where('name', 'Sari')->first())->not->toBeNull()
        ->and(Clerk::where('name', 'Sari')->first()->active)->toBeTrue();
});

test('petugas names must be unique', function () {
    Clerk::factory()->create(['name' => 'Rina']);

    $this->actingAs(User::factory()->owner()->create())
        ->post('/pengaturan/petugas', ['name' => 'Rina'])
        ->assertSessionHasErrors('name');

    expect(Clerk::where('name', 'Rina')->count())->toBe(1);
});

test('owner can rename a petugas', function () {
    $clerk = Clerk::factory()->create(['name' => 'Rina']);

    $this->actingAs(User::factory()->owner()->create())
        ->put("/pengaturan/petugas/{$clerk->id}", ['name' => 'Rina Wati'])
        ->assertRedirect();

    expect($clerk->fresh()->name)->toBe('Rina Wati');
});

test('owner can deactivate and reactivate a petugas', function () {
    $clerk = Clerk::factory()->create(['name' => 'Rina', 'active' => true]);
    $owner = User::factory()->owner()->create();

    $this->actingAs($owner)
        ->put("/pengaturan/petugas/{$clerk->id}", ['active' => false])
        ->assertRedirect();
    expect($clerk->fresh()->active)->toBeFalse();

    $this->actingAs($owner)
        ->put("/pengaturan/petugas/{$clerk->id}", ['active' => true])
        ->assertRedirect();
    expect($clerk->fresh()->active)->toBeTrue();
});

test('owner can delete a petugas without touching historical transactions', function () {
    $clerk = Clerk::factory()->create(['name' => 'Rina']);

    $this->actingAs(User::factory()->owner()->create())
        ->delete("/pengaturan/petugas/{$clerk->id}")
        ->assertRedirect();

    expect(Clerk::find($clerk->id))->toBeNull();
});

test('petugas role cannot manage the roster', function () {
    $clerk = Clerk::factory()->create(['name' => 'Rina']);
    $staff = User::factory()->petugas()->create();

    $this->actingAs($staff)->get('/pengaturan/petugas')->assertForbidden();
    $this->actingAs($staff)->post('/pengaturan/petugas', ['name' => 'X'])->assertForbidden();
    $this->actingAs($staff)->put("/pengaturan/petugas/{$clerk->id}", ['name' => 'Y'])->assertForbidden();
    $this->actingAs($staff)->delete("/pengaturan/petugas/{$clerk->id}")->assertForbidden();
});

test('the gadai form only offers active petugas but keeps customer history', function () {
    Clerk::factory()->create(['name' => 'Rina', 'active' => true]);
    Clerk::factory()->create(['name' => 'Dedi', 'active' => false]);

    $customer = Customer::create([
        'code' => 'PLG-001', 'name' => 'A', 'phone' => '081', 'join_date' => '2026-07-01',
    ]);
    $customer->transactions()->create([
        'code' => 'GCG-20260720-0001', 'device_owner' => 'A', 'device_name' => 'HP',
        'kelengkapan' => 'HP saja', 'principal' => 1_000_000, 'tenor_days' => 15,
        'fee_percent' => 10, 'fee' => 100_000, 'start_date' => '2026-07-20',
        'due_date' => '2026-08-04', 'status' => 'AKTIF', 'clerk' => 'Rina',
    ]);

    $this->actingAs(User::factory()->owner()->create())
        ->get('/gadai/baru')
        ->assertInertia(fn (Assert $page) => $page
            ->component('transaksi/create')
            ->where('petugasList', ['Rina'])
            ->where('customers.0.transactions.0.id', 'GCG-20260720-0001')
            ->where('customers.0.transactions.0.principal', 1_000_000),
        );
});

function petugasTransaction(Customer $customer, array $overrides = []): Transaction
{
    return $customer->transactions()->create(array_merge([
        'code' => 'GCG-20260720-0001', 'device_owner' => 'A', 'device_name' => 'HP',
        'kelengkapan' => 'HP saja', 'principal' => 1_000_000, 'tenor_days' => 15,
        'fee_percent' => 10, 'fee' => 100_000, 'start_date' => '2026-07-20',
        'due_date' => '2026-08-04', 'status' => 'AKTIF', 'clerk' => 'Rina',
    ], $overrides));
}

test('the petugas detail page shows stats and only that petugas transactions', function () {
    $rina = Clerk::factory()->create(['name' => 'Rina']);
    $customer = Customer::create([
        'code' => 'PLG-001', 'name' => 'Budi', 'phone' => '081', 'join_date' => '2026-07-01',
    ]);

    petugasTransaction($customer, ['code' => 'GCG-20260720-0001', 'clerk' => 'Rina']);
    petugasTransaction($customer, [
        'code' => 'GCG-20260721-0001', 'clerk' => 'Rina',
        'principal' => 2_000_000, 'fee' => 300_000, 'status' => 'DIAMBIL',
    ]);
    petugasTransaction($customer, ['code' => 'GCG-20260722-0001', 'clerk' => 'Dedi']);

    $this->actingAs(User::factory()->owner()->create())
        ->get("/pengaturan/petugas/{$rina->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->component('pengaturan/petugas-detail')
            ->where('petugas.name', 'Rina')
            ->where('stats.total', 2)
            ->where('stats.totalPrincipal', 3_000_000)
            ->where('stats.totalFee', 400_000)
            ->where('stats.running', 1)
            ->has('transactions', 2)
            ->has('byStatus', 2)
            ->has('monthly', 6),
        );
});

test('petugas role cannot view the petugas detail page', function () {
    $rina = Clerk::factory()->create(['name' => 'Rina']);

    $this->actingAs(User::factory()->petugas()->create())
        ->get("/pengaturan/petugas/{$rina->id}")
        ->assertForbidden();
});

test('deleting a petugas redirects to the roster index', function () {
    $rina = Clerk::factory()->create(['name' => 'Rina']);

    $this->actingAs(User::factory()->owner()->create())
        ->delete("/pengaturan/petugas/{$rina->id}")
        ->assertRedirect(route('pengaturan.petugas'));

    expect(Clerk::find($rina->id))->toBeNull();
});

test('a petugas name resolves to the detail page by name', function () {
    $rina = Clerk::factory()->create(['name' => 'Rina']);

    $this->actingAs(User::factory()->owner()->create())
        ->get('/pengaturan/petugas/by-name/'.rawurlencode('Rina'))
        ->assertRedirect(route('pengaturan.petugas.show', $rina));
});

test('an unknown petugas name redirects back to the roster', function () {
    $this->actingAs(User::factory()->owner()->create())
        ->get('/pengaturan/petugas/by-name/'.rawurlencode('Entah Siapa'))
        ->assertRedirect(route('pengaturan.petugas'));
});

test('petugas role cannot resolve a petugas by name', function () {
    Clerk::factory()->create(['name' => 'Rina']);

    $this->actingAs(User::factory()->petugas()->create())
        ->get('/pengaturan/petugas/by-name/'.rawurlencode('Rina'))
        ->assertForbidden();
});
