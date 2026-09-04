<?php

use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function makeTransaction(string $code, string $startDate, array $overrides = []): Transaction
{
    $customer = Customer::firstOrCreate(
        ['code' => 'PLG-'.substr(md5($code), 0, 3)],
        [
            'name' => 'Pelanggan '.$code,
            'phone' => '0812-0000-'.substr($code, -4),
            'address' => 'Jl. Serayu',
            'join_date' => '2026-07-01',
        ],
    );

    return Transaction::create(array_merge([
        'code' => $code,
        'customer_id' => $customer->id,
        'device_owner' => $customer->name,
        'device_name' => 'iPhone 15',
        'kelengkapan' => 'HP + Box',
        'principal' => 1_000_000,
        'tenor_days' => 15,
        'fee_percent' => 10,
        'fee' => 100_000,
        'start_date' => $startDate,
        'due_date' => '2026-08-04',
        'status' => 'AKTIF',
        'clerk' => 'Rina',
    ], $overrides));
}

test('guests cannot access laporan', function () {
    $this->get('/laporan')->assertRedirect(route('login'));
    $this->get('/laporan/export')->assertRedirect(route('login'));
    $this->get('/laporan/cetak')->assertRedirect(route('login'));
});

test('laporan filters transactions by period', function () {
    $user = User::factory()->owner()->create();
    makeTransaction('GC-2607-0001', '2026-07-10');
    makeTransaction('GC-2606-0001', '2026-06-10');

    $this->actingAs($user)
        ->get('/laporan?from=2026-07-01&to=2026-07-31')
        ->assertInertia(fn (Assert $page) => $page
            ->component('laporan')
            ->has('transactions', 1)
            ->where('transactions.0.id', 'GC-2607-0001')
            ->where('period.from', '2026-07-01')
            ->where('period.to', '2026-07-31')
            ->has('trend', 6),
        );
});

test('laporan defaults to the current month when no period given', function () {
    $user = User::factory()->owner()->create();

    $this->actingAs($user)
        ->get('/laporan')
        ->assertInertia(fn (Assert $page) => $page
            ->component('laporan')
            ->where('period.from', now()->startOfMonth()->toDateString())
            ->where('period.to', now()->endOfMonth()->toDateString()),
        );
});

test('laporan export returns a csv download', function () {
    $user = User::factory()->owner()->create();
    makeTransaction('GC-2607-0001', '2026-07-10');

    $response = $this->actingAs($user)
        ->get('/laporan/export?from=2026-07-01&to=2026-07-31');

    $response->assertOk();
    expect($response->headers->get('content-type'))->toContain('text/csv');
    expect($response->headers->get('content-disposition'))->toContain('laporan-gadai-2026-07-01-2026-07-31.csv');

    $body = $response->streamedContent();
    expect($body)->toContain('Kode')
        ->toContain('GC-2607-0001')
        ->toContain('Pelanggan');
});

test('laporan cetak renders the print page', function () {
    $user = User::factory()->owner()->create();
    makeTransaction('GC-2607-0001', '2026-07-10');

    $this->actingAs($user)
        ->get('/laporan/cetak?from=2026-07-01&to=2026-07-31')
        ->assertInertia(fn (Assert $page) => $page
            ->component('laporan/cetak')
            ->has('transactions', 1)
            ->where('period.from', '2026-07-01'),
        );
});

test('the fee trend carries month boundaries so a bar can be clicked', function () {
    $user = User::factory()->owner()->create();

    $this->actingAs($user)
        ->get('/laporan')
        ->assertInertia(fn (Assert $page) => $page
            ->component('laporan')
            ->has('trend', 6)
            // Six months ending with the running one.
            ->where('trend.5.from', now()->startOfMonth()->toDateString())
            ->where('trend.5.to', now()->endOfMonth()->toDateString())
            ->where('trend.5.current', true)
            ->where('trend.0.from', now()->startOfMonth()->subMonths(5)->toDateString())
            ->where('trend.0.current', false)
            ->has('trend.5.title'),
        );
});

test('the report defaults to the running month', function () {
    $user = User::factory()->owner()->create();

    $this->actingAs($user)
        ->get('/laporan')
        ->assertInertia(fn (Assert $page) => $page
            ->where('period.from', now()->startOfMonth()->toDateString())
            ->where('period.to', now()->endOfMonth()->toDateString()),
        );
});

test('clicking a trend bar narrows the report to that month', function () {
    $user = User::factory()->owner()->create();
    $lastMonth = now()->startOfMonth()->subMonth();

    // Fee earned last month must not leak into a report scoped to it.
    $tx = makeTransaction('GCG-TREND-1', $lastMonth->toDateString());
    $tx->events()->create([
        'type' => 'extended',
        'event_date' => $lastMonth->copy()->addDays(3)->toDateString(),
        'title' => 'Perpanjang',
        'amount' => 150_000,
    ]);

    $this->actingAs($user)
        ->get('/laporan?from='.$lastMonth->toDateString().'&to='.$lastMonth->copy()->endOfMonth()->toDateString())
        ->assertInertia(fn (Assert $page) => $page
            ->where('period.from', $lastMonth->toDateString())
            ->where('feeIncome.perpanjang', 150_000),
        );
});
