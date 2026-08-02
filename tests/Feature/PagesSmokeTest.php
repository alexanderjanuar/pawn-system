<?php

use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use Database\Seeders\GadaiSeeder;

beforeEach(function () {
    $this->seed(GadaiSeeder::class);
});

test('the root sends guests to login and users to the dashboard', function () {
    $this->get('/')->assertRedirect(route('login'));

    $this->actingAs(User::factory()->owner()->create())
        ->get('/')
        ->assertRedirect(route('dashboard'));
});

test('internal pages render for management users', function (string $url) {
    $this->actingAs(User::factory()->owner()->create())
        ->get($url)
        ->assertOk();
})->with([
    '/dashboard',
    '/transaksi',
    '/gadai/baru',
    '/pelanggan',
    '/jatuh-tempo',
    '/laporan',
    '/laporan/lelang',
    '/aktivitas',
]);

test('petugas is operational-only: no reports, no audit, no financial dashboard', function () {
    $petugas = User::factory()->petugas()->create();

    // Blocked from reports & audit log.
    $this->actingAs($petugas)->get('/laporan')->assertForbidden();
    $this->actingAs($petugas)->get('/laporan/lelang')->assertForbidden();
    $this->actingAs($petugas)->get('/aktivitas')->assertForbidden();

    // Redirected away from the financial dashboard to their workspace.
    $this->actingAs($petugas)->get('/dashboard')->assertRedirect('/transaksi');

    // Still has operational access.
    $this->actingAs($petugas)->get('/transaksi')->assertOk();
    $this->actingAs($petugas)->get('/gadai/baru')->assertOk();
    $this->actingAs($petugas)->get('/pelanggan')->assertOk();
    $this->actingAs($petugas)->get('/jatuh-tempo')->assertOk();
});

test('transaction detail, nota, and customer detail render', function () {
    $user = User::factory()->create();
    $tx = Transaction::query()->firstOrFail();
    $customer = Customer::query()->firstOrFail();

    $this->actingAs($user)->get("/transaksi/{$tx->code}")->assertOk();
    $this->actingAs($user)->get("/transaksi/{$tx->code}/nota")->assertOk();
    $this->actingAs($user)->get("/pelanggan/{$customer->code}")->assertOk();
});

test('public cek-status requires both code and phone', function () {
    $tx = Transaction::with('customer')->firstOrFail();
    $phone = $tx->customer->phone;

    // Empty page renders.
    $this->get('/cek-status')->assertOk();

    // Code only (e.g. scanned from the nota QR) prefills but reveals nothing.
    $this->get('/cek-status?kode='.$tx->code)
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('result', null)
            ->where('searched', false)
            ->where('query.kode', $tx->code),
        );

    // Code + matching phone reveals the transaction.
    $this->get('/cek-status?kode='.$tx->code.'&hp='.$phone)
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('result.id', $tx->code));

    // Wrong phone keeps it hidden.
    $this->get('/cek-status?kode='.$tx->code.'&hp=0000000')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('result', null)
            ->where('searched', true),
        );
});
