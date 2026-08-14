<?php

use App\Models\CashAnchor;
use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;

test('the kas export streams a CSV with itemised movements and totals', function () {
    $customer = Customer::create([
        'code' => 'PLG-120', 'name' => 'Hartatik', 'phone' => '0812', 'join_date' => '2026-07-01',
    ]);
    $tx = Transaction::create([
        'code' => 'GCG-20260813-0487', 'customer_id' => $customer->id,
        'device_owner' => 'Hartatik', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 200_000, 'tenor_days' => 15, 'fee_percent' => 15, 'fee' => 225_000,
        'start_date' => '2026-08-13', 'due_date' => '2026-08-28', 'status' => 'PERPANJANG',
        'approval_status' => 'approved', 'clerk' => 'Atul',
    ]);
    $tx->events()->createMany([
        ['type' => 'created', 'event_date' => '2026-08-13', 'title' => 'Gadai masuk', 'by' => 'Atul', 'amount' => 200_000],
        ['type' => 'extended', 'event_date' => '2026-08-13', 'title' => 'Diperpanjang', 'by' => 'Atul', 'amount' => 225_000, 'payment_method' => 'transfer'],
    ]);
    // Persisted opening cash balance for the day.
    CashAnchor::create(['store_id' => null, 'anchor_date' => '2026-08-13', 'amount' => 10_000_000]);

    // Default factory user is a petugas — they may export the daily cash.
    $response = $this->actingAs(User::factory()->create())
        ->get('/kas/export?from=2026-08-13&to=2026-08-13&shop=Gulam+Cell');

    $response->assertOk();
    $response->assertHeader('content-type', 'application/vnd.ms-excel; charset=UTF-8');
    $content = $response->getContent();

    // Header + itemised row + reconciliation block.
    expect($content)->toContain('KAS HARIAN — Gulam Cell')
        ->toContain('Hartatik')
        ->toContain('Perpanjang')
        ->toContain('Total Masuk')
        ->toContain('REKONSILIASI KAS')
        ->toContain('Saldo Awal')
        ->toContain('Rp 10.000.000') // saldo awal
        ->toContain('Kas Sistem (seharusnya di laci)')
        ->toContain('Rp 10.025.000'); // 10.000.000 + (225.000 - 200.000)
});
