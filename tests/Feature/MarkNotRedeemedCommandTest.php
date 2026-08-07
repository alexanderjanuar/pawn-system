<?php

use App\Models\Customer;
use App\Models\Transaction;

function overdueCustomer(): Customer
{
    return Customer::firstOrCreate(
        ['code' => 'PLG-001'],
        ['name' => 'A', 'phone' => '081', 'join_date' => '2026-07-01'],
    );
}

function makeTx(array $attributes): Transaction
{
    static $seq = 0;
    $seq++;

    return Transaction::create(array_merge([
        'code' => 'GCG-2026-'.str_pad((string) $seq, 4, '0', STR_PAD_LEFT),
        'customer_id' => overdueCustomer()->id,
        'device_owner' => 'A', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => '2026-07-01', 'status' => 'AKTIF', 'approval_status' => 'approved',
        'clerk' => 'Rina',
    ], $attributes));
}

beforeEach(function () {
    // Freeze "today" so the 7-day window is deterministic.
    $this->travelTo('2026-08-15');
});

test('a loan overdue by 7 or more days is marked not redeemed', function () {
    $tx = makeTx(['due_date' => '2026-08-08']); // exactly 7 days ago

    $this->artisan('gadai:mark-not-redeemed')->assertSuccessful();

    expect($tx->refresh()->status)->toBe('TIDAK_DIAMBIL')
        ->and($tx->events()->where('title', 'Ditandai tidak diambil (otomatis)')->count())->toBe(1);
});

test('a loan overdue by fewer than 7 days is left alone', function () {
    $tx = makeTx(['due_date' => '2026-08-10']); // 5 days ago

    $this->artisan('gadai:mark-not-redeemed')->assertSuccessful();

    expect($tx->refresh()->status)->toBe('AKTIF');
});

test('a pending (undisbursed) loan is never marked not redeemed', function () {
    $tx = makeTx(['due_date' => '2026-07-01', 'approval_status' => 'pending']);

    $this->artisan('gadai:mark-not-redeemed')->assertSuccessful();

    expect($tx->refresh()->status)->toBe('AKTIF');
});

test('a redeemed or auctioned loan is not touched', function () {
    $redeemed = makeTx(['due_date' => '2026-07-01', 'status' => 'DIAMBIL']);
    $lelang = makeTx(['due_date' => '2026-07-01', 'status' => 'LELANG']);

    $this->artisan('gadai:mark-not-redeemed')->assertSuccessful();

    expect($redeemed->refresh()->status)->toBe('DIAMBIL')
        ->and($lelang->refresh()->status)->toBe('LELANG');
});

test('an extended loan past the window is marked not redeemed', function () {
    $tx = makeTx(['due_date' => '2026-08-01', 'status' => 'PERPANJANG']);

    $this->artisan('gadai:mark-not-redeemed')->assertSuccessful();

    expect($tx->refresh()->status)->toBe('TIDAK_DIAMBIL');
});

test('the days window is configurable', function () {
    $tx = makeTx(['due_date' => '2026-08-12']); // 3 days ago

    $this->artisan('gadai:mark-not-redeemed --days=3')->assertSuccessful();

    expect($tx->refresh()->status)->toBe('TIDAK_DIAMBIL');
});

test('dry-run reports but changes nothing', function () {
    $tx = makeTx(['due_date' => '2026-07-01']);

    $this->artisan('gadai:mark-not-redeemed --dry-run')->assertSuccessful();

    expect($tx->refresh()->status)->toBe('AKTIF');
});
