<?php

use App\Models\ActivityLog;
use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function revertRedeemTx(array $overrides = []): Transaction
{
    $customer = Customer::firstOrCreate(
        ['code' => 'PLG-120'],
        ['name' => 'Dedi', 'phone' => '0812', 'join_date' => '2026-07-01'],
    );

    return Transaction::create(array_merge([
        'code' => 'GCG-20260805-0120', 'customer_id' => $customer->id,
        'device_owner' => 'Dedi', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => '2026-08-05', 'due_date' => '2026-08-20', 'status' => 'AKTIF',
        'approval_status' => 'approved', 'clerk' => 'Rina',
    ], $overrides));
}

test('a petugas can undo a redemption and its money leaves kas and income', function () {
    $tx = revertRedeemTx();
    $petugas = User::factory()->create();

    $this->actingAs($petugas)
        ->post("/transaksi/{$tx->code}/tebus", [
            'payment_method' => 'cash', 'fee' => 60_000, 'reason' => 'Tebus lebih awal', 'date' => '2026-08-10',
        ])
        ->assertRedirect();

    $this->get('/kas?from=2026-08-01&to=2026-08-31')
        ->assertInertia(fn (Assert $page) => $page->where('cashFlow.in.tebus', 1_060_000));

    $this->post("/transaksi/{$tx->code}/tebus/batal")
        ->assertRedirect()
        ->assertSessionHas('success');

    $tx->refresh();
    expect($tx->status)->toBe('AKTIF')
        ->and($tx->fee)->toBe(100_000) // the discount given at redemption is undone
        ->and($tx->fee_percent)->toBe(10)
        ->and((int) $tx->denda)->toBe(0)
        ->and($tx->events()->where('type', 'redeemed')->count())->toBe(0);

    $this->get('/kas?from=2026-08-01&to=2026-08-31')
        ->assertInertia(fn (Assert $page) => $page
            ->where('cashFlow.in.tebus', 0)
            ->where('cashFlow.in.total', 0)
            ->has('cashFlow.entries', 0),
        );

    $this->actingAs(User::factory()->owner()->create())
        ->get('/laporan?from=2026-08-01&to=2026-08-31')
        ->assertInertia(fn (Assert $page) => $page
            ->where('feeIncome.tebus', 0)
            ->where('feeIncome.total', 0),
        );

    $log = ActivityLog::query()->where('description', 'like', 'Membatalkan tebus%')->sole();
    expect($log->description)->toContain('Rp 1.060.000')
        ->and($log->description)->toContain('2026-08-10')
        ->and($log->flagged)->toBeTrue()
        ->and($log->changes)->toContain(['field' => 'Status', 'from' => 'DIAMBIL', 'to' => 'AKTIF'])
        ->and($log->changes)->toContain(['field' => 'Biaya titipan', 'from' => 'Rp 60.000', 'to' => 'Rp 100.000']);
});

test('undoing a redemption restores the status the loan had before', function (string $status, int $extensions) {
    $tx = revertRedeemTx(['status' => $status, 'extensions' => $extensions]);

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/tebus", ['date' => '2026-08-10'])
        ->assertRedirect();

    $this->post("/transaksi/{$tx->code}/tebus/batal")->assertRedirect();

    expect($tx->refresh()->status)->toBe($status);
})->with([
    'aktif' => ['AKTIF', 0],
    'perpanjang' => ['PERPANJANG', 1],
    'tidak diambil' => ['TIDAK_DIAMBIL', 0],
]);

test('a redemption recorded before snapshots existed falls back to the extension count', function () {
    $tx = revertRedeemTx(['status' => 'DIAMBIL', 'extensions' => 2, 'fee' => 80_000, 'fee_percent' => 8, 'denda' => 15_000]);
    $tx->events()->create([
        'type' => 'redeemed', 'event_date' => '2026-08-10', 'title' => 'Ditebus & diambil',
        'by' => 'Rina', 'amount' => 1_095_000,
    ]);

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/tebus/batal")
        ->assertRedirect();

    $tx->refresh();
    expect($tx->status)->toBe('PERPANJANG')
        ->and($tx->fee)->toBe(80_000)
        ->and((int) $tx->denda)->toBe(0)
        ->and($tx->events()->where('type', 'redeemed')->count())->toBe(0);
});

test('a loan that was not redeemed cannot have its redemption undone', function () {
    $tx = revertRedeemTx(['status' => 'PERPANJANG', 'extensions' => 1]);
    $tx->events()->create([
        'type' => 'extended', 'event_date' => '2026-08-10', 'title' => 'Diperpanjang', 'by' => 'Rina', 'amount' => 100_000,
    ]);

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/tebus/batal")
        ->assertRedirect()
        ->assertSessionHas('error');

    expect($tx->refresh()->status)->toBe('PERPANJANG')
        ->and($tx->events()->count())->toBe(1);
});

test('redeeming again after an undo counts the money only once', function () {
    $tx = revertRedeemTx();

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/tebus", ['date' => '2026-08-10'])
        ->assertRedirect();
    $this->post("/transaksi/{$tx->code}/tebus/batal")->assertRedirect();
    $this->post("/transaksi/{$tx->code}/tebus", ['date' => '2026-08-12'])->assertRedirect();

    expect($tx->refresh()->status)->toBe('DIAMBIL');

    $this->get('/kas?from=2026-08-01&to=2026-08-31')
        ->assertInertia(fn (Assert $page) => $page
            ->where('cashFlow.in.tebus', 1_100_000)
            ->has('cashFlow.entries', 1),
        );
});
