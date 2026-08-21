<?php

use App\Models\CashAnchor;
use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use Inertia\Testing\AssertableInertia as Assert;

test('two default wallets are seeded and shared to the frontend', function () {
    expect(Wallet::whereIn('name', ['Toko', 'Kak Gulam'])->count())->toBe(2)
        ->and(Wallet::where('is_default', true)->value('name'))->toBe('Toko');

    $this->actingAs(User::factory()->create())
        ->get('/kas')
        ->assertInertia(fn (Assert $page) => $page->has('wallets'));
});

test('a gadai records the chosen funding wallet on its created event', function () {
    $lender = Wallet::create(['name' => 'Kak Gulam Test', 'is_active' => true, 'sort' => 5]);
    $customer = Customer::create([
        'code' => 'PLG-700', 'name' => 'Sari', 'phone' => '0812', 'join_date' => '2026-07-01',
    ]);

    $this->actingAs(User::factory()->create())
        ->post('/gadai', [
            'customer_mode' => 'existing',
            'customer_code' => $customer->code,
            'device_name' => 'HP',
            'kelengkapan' => 'HP saja',
            'principal' => 1_000_000,
            'tenor_choice' => '15',
            'start_date' => '2026-08-14',
            'wallet_id' => $lender->id,
        ])
        ->assertRedirect();

    expect(Transaction::first()->events()->where('type', 'created')->value('wallet_id'))
        ->toBe($lender->id);
});

test('redeeming into a wallet is reflected in that wallet\'s daily balance', function () {
    $lender = Wallet::create(['name' => 'Kak Gulam Test', 'is_active' => true, 'sort' => 5]);

    $customer = Customer::create([
        'code' => 'PLG-701', 'name' => 'Doni', 'phone' => '0812', 'join_date' => '2026-07-01',
    ]);
    $tx = Transaction::create([
        'code' => 'GCG-20260814-0701', 'customer_id' => $customer->id,
        'device_owner' => 'Doni', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => '2026-08-14', 'due_date' => '2026-08-29', 'status' => 'AKTIF',
        'approval_status' => 'approved', 'clerk' => 'Atul',
    ]);

    // Redeem (1.100.000 in) attributed to the lender's pocket, recorded today.
    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/tebus", ['payment_method' => 'cash', 'wallet_id' => $lender->id])
        ->assertRedirect();

    // Kas defaults to today, matching the redeem event's date.
    $this->actingAs(User::factory()->create())
        ->get('/kas')
        ->assertInertia(fn (Assert $page) => $page
            ->where('cashFlow.byWallet.'.$lender->id.'.in', 1_100_000)
            ->where('cashFlow.byWallet.'.$lender->id.'.net', 1_100_000)
        );
});

test('opening balance is tracked per wallet', function () {
    $toko = Wallet::where('is_default', true)->first();
    $lender = Wallet::create(['name' => 'Kak Gulam Test', 'is_active' => true, 'sort' => 5]);

    CashAnchor::create(['store_id' => null, 'wallet_id' => $toko->id, 'anchor_date' => '2026-08-14', 'amount' => 5_000_000]);
    CashAnchor::create(['store_id' => null, 'wallet_id' => $lender->id, 'anchor_date' => '2026-08-14', 'amount' => 3_000_000]);

    $this->actingAs(User::factory()->create())
        ->get('/kas?from=2026-08-14&to=2026-08-14')
        ->assertInertia(fn (Assert $page) => $page
            ->where('saldoAwal', 8_000_000) // sum across pockets
            ->where('walletSummary', fn ($wallets) => collect($wallets)
                ->firstWhere('id', $lender->id)['saldoAwal'] === 3_000_000)
        );
});

test('a gadai can be funded from a split across pockets', function () {
    $toko = Wallet::where('is_default', true)->first();
    $lender = Wallet::create(['name' => 'Kak Gulam Test', 'is_active' => true, 'sort' => 5]);
    $customer = Customer::create([
        'code' => 'PLG-710', 'name' => 'Split', 'phone' => '0812', 'join_date' => '2026-07-01',
    ]);

    $this->actingAs(User::factory()->create())
        ->post('/gadai', [
            'customer_mode' => 'existing',
            'customer_code' => $customer->code,
            'device_name' => 'HP',
            'kelengkapan' => 'HP saja',
            'principal' => 1_000_000,
            'tenor_choice' => '15',
            'start_date' => '2026-08-14',
            'wallet_split' => [
                ['wallet_id' => $toko->id, 'amount' => 900_000],
                ['wallet_id' => $lender->id, 'amount' => 100_000],
            ],
        ])
        ->assertRedirect();

    $event = Transaction::first()->events()->where('type', 'created')->first();
    expect($event->wallet_split)->toHaveCount(2);

    // The disbursement out splits 900k/100k across the two pockets.
    $this->actingAs(User::factory()->create())
        ->get('/kas?from=2026-08-14&to=2026-08-14')
        ->assertInertia(fn (Assert $page) => $page
            ->where('cashFlow.byWallet.'.$toko->id.'.out', 900_000)
            ->where('cashFlow.byWallet.'.$lender->id.'.out', 100_000)
            ->where('cashFlow.out.total', 1_000_000)
        );
});

test('a split that does not add up to the principal is rejected', function () {
    $toko = Wallet::where('is_default', true)->first();
    $lender = Wallet::create(['name' => 'Kak Gulam Test', 'is_active' => true, 'sort' => 5]);
    $customer = Customer::create([
        'code' => 'PLG-711', 'name' => 'Bad Split', 'phone' => '0812', 'join_date' => '2026-07-01',
    ]);

    $this->actingAs(User::factory()->create())
        ->post('/gadai', [
            'customer_mode' => 'existing',
            'customer_code' => $customer->code,
            'device_name' => 'HP',
            'kelengkapan' => 'HP saja',
            'principal' => 1_000_000,
            'tenor_choice' => '15',
            'start_date' => '2026-08-14',
            'wallet_split' => [
                ['wallet_id' => $toko->id, 'amount' => 900_000],
                ['wallet_id' => $lender->id, 'amount' => 50_000], // 950k != 1jt
            ],
        ])
        ->assertSessionHasErrors('wallet_split');

    expect(Transaction::count())->toBe(0);
});

test('opening balance shows in the all-stores view even when saved per store', function () {
    $toko = Wallet::where('is_default', true)->first();
    $lender = Wallet::create(['name' => 'Kak Gulam Test', 'is_active' => true, 'sort' => 5]);

    // Anchors saved under a specific store (store_id = 1), while the owner
    // views "Semua Toko" (no active store) in the request below.
    CashAnchor::create(['store_id' => 1, 'wallet_id' => $toko->id, 'anchor_date' => '2026-08-14', 'amount' => 3_990_000]);
    CashAnchor::create(['store_id' => 1, 'wallet_id' => $lender->id, 'anchor_date' => '2026-08-14', 'amount' => 10_000_000]);

    $this->actingAs(User::factory()->create())
        ->get('/kas?from=2026-08-14&to=2026-08-14')
        ->assertInertia(fn (Assert $page) => $page
            ->where('saldoAwal', 13_990_000) // aggregated across stores
            ->where('walletSummary', fn ($wallets) => collect($wallets)
                ->firstWhere('id', $lender->id)['saldoAwal'] === 10_000_000)
        );
});

test('a used wallet cannot be hard-deleted but an unused one can', function () {
    $used = Wallet::create(['name' => 'Dipakai', 'is_active' => true, 'sort' => 5]);
    $unused = Wallet::create(['name' => 'Kosong', 'is_active' => true, 'sort' => 6]);

    $customer = Customer::create([
        'code' => 'PLG-702', 'name' => 'Eka', 'phone' => '0812', 'join_date' => '2026-07-01',
    ]);
    $tx = Transaction::create([
        'code' => 'GCG-20260814-0702', 'customer_id' => $customer->id,
        'device_owner' => 'Eka', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 500_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 50_000,
        'start_date' => '2026-08-14', 'due_date' => '2026-08-29', 'status' => 'AKTIF',
        'approval_status' => 'approved', 'clerk' => 'Atul',
    ]);
    $tx->events()->create(['type' => 'created', 'event_date' => '2026-08-14', 'title' => 'x', 'amount' => 500_000, 'wallet_id' => $used->id]);

    $owner = User::factory()->create(['role' => 'owner']);

    $this->actingAs($owner)->delete("/pengaturan/dompet/{$used->id}")->assertSessionHas('error');
    expect(Wallet::find($used->id))->not->toBeNull();

    $this->actingAs($owner)->delete("/pengaturan/dompet/{$unused->id}")->assertSessionHas('success');
    expect(Wallet::find($unused->id))->toBeNull();
});
