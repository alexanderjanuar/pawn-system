<?php

use App\Models\Piutang;
use App\Models\Store;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function piutangStore(): Store
{
    return Store::create(['code' => 'TK-001', 'nota_prefix' => 'GCG', 'name' => 'Toko A', 'active' => true]);
}

function makePiutang(Store $store, array $overrides = []): Piutang
{
    return Piutang::create(array_merge([
        'store_id' => $store->id,
        'code' => 'PT-'.fake()->unique()->numerify('########'),
        'debtor_name' => 'Rina',
        'device_name' => 'Redmi 13C',
        'price' => 1_000_000,
        'date' => '2026-07-25',
        'status' => 'berjalan',
    ], $overrides));
}

test('petugas can record a piutang for their store', function () {
    $store = piutangStore();
    $petugas = User::factory()->petugas()->create(['store_id' => $store->id]);

    $this->actingAs($petugas)->post('/piutang', [
        'debtor_name' => 'Rina',
        'device_name' => 'Redmi 13C',
        'price' => 1_800_000,
        'date' => '2026-07-25',
    ])->assertRedirect();

    $p = Piutang::first();
    expect($p)->not->toBeNull()
        ->and($p->store_id)->toBe($store->id)
        ->and($p->status)->toBe('berjalan')
        ->and($p->code)->toStartWith('PT-')
        ->and($p->clerk)->toBe($petugas->name);
});

test('a payment reduces the balance and marks lunas when fully paid', function () {
    $store = piutangStore();
    $petugas = User::factory()->petugas()->create(['store_id' => $store->id]);
    $p = makePiutang($store, ['price' => 1_000_000]);

    $this->actingAs($petugas)->post("/piutang/{$p->id}/bayar", [
        'amount' => 400_000, 'paid_at' => '2026-07-26',
    ])->assertRedirect();
    expect($p->fresh()->remaining())->toBe(600_000)
        ->and($p->fresh()->status)->toBe('berjalan');

    $this->actingAs($petugas)->post("/piutang/{$p->id}/bayar", [
        'amount' => 600_000, 'paid_at' => '2026-07-27',
    ])->assertRedirect();
    expect($p->fresh()->remaining())->toBe(0)
        ->and($p->fresh()->status)->toBe('lunas');
});

test('a payment cannot exceed the remaining balance', function () {
    $store = piutangStore();
    $petugas = User::factory()->petugas()->create(['store_id' => $store->id]);
    $p = makePiutang($store, ['price' => 500_000]);

    $this->actingAs($petugas)->post("/piutang/{$p->id}/bayar", [
        'amount' => 600_000, 'paid_at' => '2026-07-26',
    ])->assertSessionHasErrors('amount');

    expect($p->fresh()->payments()->count())->toBe(0);
});

test('the piutang index is scoped to the active store', function () {
    $a = piutangStore();
    $b = Store::create(['code' => 'TK-002', 'nota_prefix' => 'GCC', 'name' => 'Toko B', 'active' => true]);
    makePiutang($a, ['code' => 'PT-A', 'debtor_name' => 'A']);
    makePiutang($b, ['code' => 'PT-B', 'debtor_name' => 'B']);

    $petugas = User::factory()->petugas()->create(['store_id' => $a->id]);

    $this->actingAs($petugas)->get('/piutang')
        ->assertInertia(fn (Assert $page) => $page
            ->component('piutang/index')
            ->has('piutangs', 1)
            ->where('piutangs.0.code', 'PT-A'),
        );
});

test('a piutang can be created with an even termin schedule', function () {
    $store = piutangStore();
    $petugas = User::factory()->petugas()->create(['store_id' => $store->id]);

    $this->actingAs($petugas)->post('/piutang', [
        'debtor_name' => 'Rina',
        'device_name' => 'HP',
        'price' => 1_800_000,
        'date' => '2026-07-25',
        'termin_count' => 3,
    ])->assertRedirect();

    $p = Piutang::first();
    expect($p->termins()->count())->toBe(3)
        ->and((int) $p->termins()->sum('amount'))->toBe(1_800_000)
        ->and($p->termins()->orderBy('seq')->pluck('amount')->all())
        ->toBe([600_000, 600_000, 600_000]);
});

test('setting termins splits the total with rounding on the last termin', function () {
    $store = piutangStore();
    $p = makePiutang($store, ['price' => 1_000_000]);

    $this->actingAs(User::factory()->petugas()->create(['store_id' => $store->id]))
        ->put("/piutang/{$p->id}/termin", ['termin_count' => 3])
        ->assertRedirect();

    expect($p->termins()->orderBy('seq')->pluck('amount')->all())
        ->toBe([333_333, 333_333, 333_334]);
});

test('the termin schedule exposes computed status on the detail page', function () {
    $store = piutangStore();
    $p = makePiutang($store, ['price' => 900_000, 'date' => '2026-01-01']);
    $p->generateTermins(3, $p->date); // due Feb/Mar/Apr 2026 — all past
    $p->payments()->create(['amount' => 300_000, 'paid_at' => '2026-02-01']);
    $p->syncStatus();

    $this->actingAs(User::factory()->owner()->create())
        ->get("/piutang/{$p->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->component('piutang/show')
            ->where('piutang.termins.0.status', 'lunas')
            ->where('piutang.termins.1.status', 'telat'),
        );
});

test('only management can delete a piutang', function () {
    $store = piutangStore();
    $p = makePiutang($store);
    $petugas = User::factory()->petugas()->create(['store_id' => $store->id]);

    $this->actingAs($petugas)->delete("/piutang/{$p->id}")->assertForbidden();
    expect(Piutang::find($p->id))->not->toBeNull();

    $this->actingAs(User::factory()->owner()->create())
        ->delete("/piutang/{$p->id}")->assertRedirect();
    expect(Piutang::find($p->id))->toBeNull();
});

test('only management can delete a payment', function () {
    $store = piutangStore();
    $p = makePiutang($store, ['price' => 1_000_000]);
    $payment = $p->payments()->create(['amount' => 400_000, 'paid_at' => '2026-07-26']);
    $petugas = User::factory()->petugas()->create(['store_id' => $store->id]);

    $this->actingAs($petugas)
        ->delete("/piutang/{$p->id}/bayar/{$payment->id}")->assertForbidden();

    $this->actingAs(User::factory()->owner()->create())
        ->delete("/piutang/{$p->id}/bayar/{$payment->id}")->assertRedirect();
    expect($p->fresh()->payments()->count())->toBe(0);
});
