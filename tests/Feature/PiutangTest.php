<?php

use App\Models\ActivityLog;
use App\Models\Piutang;
use App\Models\Store;
use App\Models\User;
use App\Services\Fonnte;
use Illuminate\Support\Facades\Http;
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

test('a DP reduces the financed amount and termins split from it', function () {
    $store = piutangStore();
    $petugas = User::factory()->petugas()->create(['store_id' => $store->id]);

    $this->actingAs($petugas)->post('/piutang', [
        'debtor_name' => 'Rina',
        'device_name' => 'HP',
        'price' => 1_800_000,
        'down_payment' => 300_000,
        'date' => '2026-07-25',
        'termin_count' => 3,
    ])->assertRedirect();

    $p = Piutang::first();
    expect($p->down_payment)->toBe(300_000)
        ->and($p->financed())->toBe(1_500_000)
        ->and($p->remaining())->toBe(1_500_000) // financed, nothing paid yet
        ->and($p->termins()->orderBy('seq')->pluck('amount')->all())
        ->toBe([500_000, 500_000, 500_000]); // 1.5jt / 3, not 1.8jt
});

test('the DP cannot exceed the total price', function () {
    $store = piutangStore();

    $this->actingAs(User::factory()->petugas()->create(['store_id' => $store->id]))
        ->post('/piutang', [
            'debtor_name' => 'A', 'device_name' => 'HP',
            'price' => 1_000_000, 'down_payment' => 1_500_000, 'date' => '2026-07-25',
        ])->assertSessionHasErrors('down_payment');

    expect(Piutang::count())->toBe(0);
});

test('a piutang is lunas once payments cover the financed amount, not the full price', function () {
    $store = piutangStore();
    $petugas = User::factory()->petugas()->create(['store_id' => $store->id]);
    $p = makePiutang($store, ['price' => 1_000_000, 'down_payment' => 400_000]);

    // Financed = 600.000. Paying that off marks it lunas.
    $this->actingAs($petugas)->post("/piutang/{$p->id}/bayar", [
        'amount' => 600_000, 'paid_at' => '2026-07-26',
    ])->assertRedirect();

    expect($p->fresh()->remaining())->toBe(0)
        ->and($p->fresh()->status)->toBe('lunas');
});

test('petugas can edit a piutang', function () {
    $store = piutangStore();
    $p = makePiutang($store);
    $petugas = User::factory()->petugas()->create(['store_id' => $store->id]);

    $this->actingAs($petugas)->put("/piutang/{$p->id}", [
        'debtor_name' => 'Nama Baru',
        'device_name' => 'HP Baru',
        'price' => 2_000_000,
        'date' => $p->date->toDateString(),
    ])->assertRedirect();

    $p->refresh();
    expect($p->debtor_name)->toBe('Nama Baru')
        ->and($p->device_name)->toBe('HP Baru')
        ->and($p->price)->toBe(2_000_000);
});

test('editing the price re-splits the existing termin schedule', function () {
    $store = piutangStore();
    $p = makePiutang($store, ['price' => 900_000]);
    $p->generateTermins(3, $p->date); // 3 x 300.000

    $this->actingAs(User::factory()->petugas()->create(['store_id' => $store->id]))
        ->put("/piutang/{$p->id}", [
            'debtor_name' => $p->debtor_name,
            'device_name' => $p->device_name,
            'price' => 1_200_000,
            'date' => $p->date->toDateString(),
        ])->assertRedirect();

    expect($p->fresh()->termins()->orderBy('seq')->pluck('amount')->all())
        ->toBe([400_000, 400_000, 400_000]);
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

test('the piutang list carries the next unpaid termin so a reminder can be sent', function () {
    $store = piutangStore();
    // Termin 1 fell due a month ago and is settled; termin 2 falls due today.
    $p = makePiutang($store, ['date' => now()->subMonths(2)->toDateString(), 'price' => 900_000]);
    $p->generateTermins(3, $p->date);
    $p->payments()->create(['amount' => 300_000, 'paid_at' => now()->toDateString()]);

    $this->actingAs(User::factory()->petugas()->create(['store_id' => $store->id]))
        ->get('/piutang')
        ->assertInertia(fn (Assert $page) => $page
            ->component('piutang/index')
            ->where('piutangs.0.nextDue.seq', 2)
            ->where('piutangs.0.nextDue.amount', 300_000)
            ->where('piutangs.0.late', false),
        );
});

test('an overdue termin marks the piutang as late', function () {
    $store = piutangStore();
    $p = makePiutang($store, ['date' => now()->subMonths(3)->toDateString(), 'price' => 900_000]);
    $p->generateTermins(3, $p->date);

    $this->actingAs(User::factory()->petugas()->create(['store_id' => $store->id]))
        ->get('/piutang')
        ->assertInertia(fn (Assert $page) => $page
            ->where('piutangs.0.late', true)
            ->where('piutangs.0.nextDue.seq', 1),
        );
});

test('a WhatsApp instalment reminder is sent to the debtor', function () {
    $this->app->instance(Fonnte::class, new Fonnte('test-token'));

    $store = piutangStore();
    $p = makePiutang($store, ['debtor_phone' => '081253721672']);

    $this->actingAs(User::factory()->petugas()->create(['store_id' => $store->id]))
        ->post("/piutang/{$p->id}/ingatkan", ['message' => 'Halo Rina, cicilan Anda jatuh tempo.'])
        ->assertRedirect()
        ->assertSessionHas('success');

    Http::assertSent(fn ($request) => str_contains($request->url(), 'api.fonnte.com')
        && $request['target'] === '081253721672'
        && str_contains($request['message'], 'cicilan Anda'));

    expect(ActivityLog::where('subject_code', $p->code)
        ->where('description', 'Mengirim pengingat WhatsApp')
        ->exists())->toBeTrue();
});

test('a reminder is refused when the debtor has no WhatsApp number', function () {
    $this->app->instance(Fonnte::class, new Fonnte('test-token'));

    $store = piutangStore();
    $p = makePiutang($store);

    $this->actingAs(User::factory()->petugas()->create(['store_id' => $store->id]))
        ->post("/piutang/{$p->id}/ingatkan", ['message' => 'Halo Rina.'])
        ->assertRedirect()
        ->assertSessionHas('error');

    Http::assertNothingSent();
});

test('a debtor phone number is saved with the piutang', function () {
    $store = piutangStore();

    $this->actingAs(User::factory()->petugas()->create(['store_id' => $store->id]))
        ->post('/piutang', [
            'debtor_name' => 'Rina',
            'debtor_phone' => '081253721672',
            'device_name' => 'Redmi 13C',
            'price' => 1_800_000,
            'date' => '2026-07-25',
        ])->assertRedirect();

    expect(Piutang::first()->debtor_phone)->toBe('081253721672');
});
