<?php

use App\Models\ActivityLog;
use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function revertSaleTx(array $overrides = []): Transaction
{
    $customer = Customer::firstOrCreate(
        ['code' => 'PLG-130'],
        ['name' => 'Wawan', 'phone' => '0812', 'join_date' => '2026-07-01'],
    );

    $tx = Transaction::create(array_merge([
        'code' => 'GCG-20260801-0130', 'customer_id' => $customer->id,
        'device_owner' => 'Wawan', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => '2026-08-01', 'due_date' => '2026-08-16', 'status' => 'LELANG',
        'approval_status' => 'approved', 'clerk' => 'Rina',
    ], $overrides));

    $tx->events()->create([
        'type' => 'auctioned', 'event_date' => '2026-08-25', 'title' => 'Ditandai untuk lelang', 'by' => 'Rina',
    ]);

    return $tx;
}

test('a petugas can undo a recorded auction sale and its money leaves kas and profit', function () {
    $tx = revertSaleTx();

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/sale", ['sale_value' => 1_300_000, 'date' => '2026-09-01'])
        ->assertRedirect();

    $this->get('/kas?from=2026-09-01&to=2026-09-30')
        ->assertInertia(fn (Assert $page) => $page->where('cashFlow.in.lelang', 1_300_000));

    $this->post("/transaksi/{$tx->code}/sale/batal")
        ->assertRedirect()
        ->assertSessionHas('success');

    $tx->refresh();
    expect($tx->status)->toBe('LELANG')
        ->and($tx->sale_value)->toBeNull()
        ->and($tx->sold_at)->toBeNull()
        // The auction mark stays; only the sale is gone.
        ->and($tx->events()->where('type', 'auctioned')->count())->toBe(1)
        ->and($tx->events()->where('type', 'auctioned')->whereNotNull('amount')->count())->toBe(0);

    $this->get('/kas?from=2026-09-01&to=2026-09-30')
        ->assertInertia(fn (Assert $page) => $page
            ->where('cashFlow.in.lelang', 0)
            ->where('cashFlow.in.total', 0),
        );

    $this->actingAs(User::factory()->owner()->create())
        ->get('/laporan?from=2026-09-01&to=2026-09-30')
        ->assertInertia(fn (Assert $page) => $page
            ->where('profit.selisihJual', 0)
            ->where('profit.terjual', 0),
        );

    $log = ActivityLog::query()->where('description', 'like', 'Membatalkan penjualan%')->sole();
    expect($log->description)->toContain('lelang')
        ->and($log->description)->toContain('Rp 1.300.000')
        ->and($log->description)->toContain('2026-09-01')
        ->and($log->flagged)->toBeTrue()
        ->and($log->changes)->toContain(['field' => 'Nilai jual', 'from' => 'Rp 1.300.000', 'to' => '—']);
});

test('after undoing the sale the item can be taken off auction back to active', function () {
    $tx = revertSaleTx();

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/sale", ['sale_value' => 900_000, 'date' => '2026-09-01'])
        ->assertRedirect();
    $this->post("/transaksi/{$tx->code}/sale/batal")->assertRedirect();
    $this->post("/transaksi/{$tx->code}/lelang/batal")->assertRedirect();

    expect($tx->refresh()->status)->toBe('AKTIF');
});

test('undoing the sale of a forfeited item makes it redeemable again', function () {
    $tx = revertSaleTx(['status' => 'TIDAK_DIAMBIL']);

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/sale", ['sale_value' => 1_200_000, 'date' => '2026-09-01'])
        ->assertRedirect();
    $this->post("/transaksi/{$tx->code}/sale/batal")->assertRedirect();

    expect($tx->refresh()->status)->toBe('TIDAK_DIAMBIL')
        ->and($tx->sold_at)->toBeNull();

    $this->post("/transaksi/{$tx->code}/tebus", ['date' => '2026-09-02'])->assertRedirect();

    expect($tx->refresh()->status)->toBe('DIAMBIL');
});

test('a sale recorded at zero is undone too', function () {
    $tx = revertSaleTx();

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/sale", ['sale_value' => 0, 'date' => '2026-09-01'])
        ->assertRedirect();
    $this->post("/transaksi/{$tx->code}/sale/batal")->assertRedirect();

    expect($tx->refresh()->sold_at)->toBeNull()
        ->and($tx->events()->whereNotNull('amount')->count())->toBe(0);
});

test('an unsold item has no sale to undo', function () {
    $tx = revertSaleTx();

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/sale/batal")
        ->assertRedirect()
        ->assertSessionHas('error');

    expect($tx->refresh()->status)->toBe('LELANG')
        ->and($tx->events()->count())->toBe(1);
});

test('re-selling after an undo counts the money only once', function () {
    $tx = revertSaleTx();

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/sale", ['sale_value' => 1_000_000, 'date' => '2026-09-01'])
        ->assertRedirect();
    $this->post("/transaksi/{$tx->code}/sale/batal")->assertRedirect();
    $this->post("/transaksi/{$tx->code}/sale", ['sale_value' => 1_250_000, 'date' => '2026-09-03'])->assertRedirect();

    $this->get('/kas?from=2026-09-01&to=2026-09-30')
        ->assertInertia(fn (Assert $page) => $page
            ->where('cashFlow.in.lelang', 1_250_000)
            ->has('cashFlow.entries', 1),
        );
});
