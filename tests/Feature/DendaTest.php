<?php

use App\Models\Customer;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\User;
use App\Support\LateFee;
use Inertia\Testing\AssertableInertia as Assert;

function dendaRule(string $mode, float $value, int $grace = 0, int $max = 0): void
{
    Setting::put('denda_mode', $mode);
    Setting::put('denda_value', $value);
    Setting::put('denda_grace_days', $grace);
    Setting::put('denda_max_days', $max);
}

function dendaTransaction(int $daysLate = 10, array $overrides = []): Transaction
{
    $customer = Customer::firstOrCreate(
        ['code' => 'PLG-700'],
        ['name' => 'Budi', 'phone' => '081200000000', 'join_date' => '2026-01-01'],
    );

    return Transaction::create(array_merge([
        'code' => 'GCG-DENDA-'.fake()->unique()->numerify('####'),
        'customer_id' => $customer->id,
        'device_owner' => 'Budi', 'device_name' => 'iPhone 13', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => now()->subDays($daysLate + 15)->toDateString(),
        'due_date' => now()->subDays($daysLate)->toDateString(),
        'status' => 'AKTIF', 'approval_status' => 'approved', 'clerk' => 'Rina',
    ], $overrides));
}

test('no late fee is charged until the shop turns it on', function () {
    dendaRule('off', 0);

    expect(LateFee::amount(dendaTransaction()))->toBe(0);
});

test('the late fee follows the rule the shop chose', function (string $mode, float $value, int $expected) {
    dendaRule($mode, $value);

    expect(LateFee::amount(dendaTransaction(10)))->toBe($expected);
})->with([
    // 0.5% of a 1jt loan is 5.000 a day, over 10 days.
    'persen dari dana titipan' => ['percent_principal', 0.5, 50_000],
    // 1% of a 100rb fee is 1.000 a day.
    'persen dari biaya titipan' => ['percent_fee', 1.0, 10_000],
    'nominal tetap' => ['nominal', 5_000, 50_000],
]);

test('the grace period is forgiven before the late fee starts', function () {
    dendaRule('percent_principal', 0.5, grace: 3);

    // 10 days late, 3 forgiven, so 7 chargeable days at 5.000.
    expect(LateFee::amount(dendaTransaction(10)))->toBe(35_000);
});

test('the late fee stops growing at the cap', function () {
    dendaRule('nominal', 5_000, max: 5);

    expect(LateFee::amount(dendaTransaction(30)))->toBe(25_000);
});

test('an item that is not overdue owes nothing', function () {
    dendaRule('nominal', 5_000);
    $tx = dendaTransaction(0, ['due_date' => now()->addDays(5)->toDateString()]);

    expect(LateFee::amount($tx))->toBe(0);
});

test('an item that already left the shop stops accruing', function () {
    dendaRule('nominal', 5_000);

    expect(LateFee::amount(dendaTransaction(10, ['status' => 'DIAMBIL'])))->toBe(0)
        ->and(LateFee::amount(dendaTransaction(10, ['status' => 'LELANG'])))->toBe(0);
});

test('redeeming an overdue item charges the late fee into the cash', function () {
    dendaRule('nominal', 5_000);
    $tx = dendaTransaction(10);

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/tebus")
        ->assertRedirect();

    $tx->refresh();
    $event = $tx->events()->where('type', 'redeemed')->first();

    expect($tx->denda)->toBe(50_000)
        // Dana titipan + biaya + denda all land in Kas Harian together.
        ->and((int) $event->amount)->toBe(1_150_000);
});

test('waiving part of the late fee needs a reason', function () {
    dendaRule('nominal', 5_000);
    $tx = dendaTransaction(10);

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/tebus", ['denda' => 0])
        ->assertSessionHasErrors('reason');

    expect($tx->refresh()->status)->toBe('AKTIF');
});

test('a waived late fee is recorded with its reason', function () {
    dendaRule('nominal', 5_000);
    $tx = dendaTransaction(10);

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/tebus", [
            'denda' => 20_000,
            'reason' => 'Nego pelanggan',
        ])->assertRedirect();

    $tx->refresh();

    expect($tx->denda)->toBe(20_000)
        ->and((int) $tx->events()->where('type', 'redeemed')->first()->amount)->toBe(1_120_000);
});

test('a back-dated redemption is only charged up to that day', function () {
    dendaRule('nominal', 5_000);
    $tx = dendaTransaction(10);

    // Collected 4 days ago, so only 6 late days are owed, not 10.
    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/tebus", ['date' => now()->subDays(4)->toDateString()])
        ->assertRedirect();

    expect($tx->refresh()->denda)->toBe(30_000);
});

test('the report keeps late-fee income apart from deposit-fee income', function () {
    dendaRule('nominal', 5_000);
    $tx = dendaTransaction(10);

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/tebus")
        ->assertRedirect();

    $this->actingAs(User::factory()->owner()->create())
        ->get('/laporan?from='.now()->startOfMonth()->toDateString().'&to='.now()->endOfMonth()->toDateString())
        ->assertInertia(fn (Assert $page) => $page
            ->where('feeIncome.tebus', 100_000)
            ->where('feeIncome.denda', 50_000)
            ->where('feeIncome.total', 150_000),
        );
});

test('the owner can change the whole late-fee rule', function () {
    $this->actingAs(User::factory()->owner()->create())
        ->put('/pengaturan/biaya', [
            'denda_mode' => 'percent_principal',
            'denda_value' => 0.75,
            'denda_grace_days' => 2,
            'denda_max_days' => 30,
        ])->assertRedirect();

    expect(LateFee::settings())->toBe([
        'mode' => 'percent_principal',
        'value' => 0.75,
        'graceDays' => 2,
        'maxDays' => 30,
    ]);
});

test('an auction sale can be back-dated into the right day of cash', function () {
    $tx = dendaTransaction(30, ['status' => 'LELANG']);
    $when = now()->subDays(3)->toDateString();

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/sale", ['sale_value' => 1_200_000, 'date' => $when])
        ->assertRedirect();

    $event = $tx->refresh()->events()->where('type', 'auctioned')->latest('id')->first();

    expect($tx->sale_value)->toBe(1_200_000)
        ->and($event->event_date->toDateString())->toBe($when)
        ->and((int) $event->amount)->toBe(1_200_000);
});

test('an item can carry its own late-fee rule, overriding the shop', function () {
    dendaRule('nominal', 5_000);
    $tx = dendaTransaction(10, [
        'denda_mode' => 'nominal',
        'denda_value' => 20_000,
    ]);

    expect(LateFee::amount($tx))->toBe(200_000)
        ->and(LateFee::ruleFor($tx)['custom'])->toBeTrue();
});

test('an item rule applies even when the shop charges nothing', function () {
    dendaRule('off', 0);
    $tx = dendaTransaction(10, [
        'denda_mode' => 'percent_principal',
        'denda_value' => 1,
    ]);

    // 1% of 1jt is 10.000 a day, over 10 days.
    expect(LateFee::amount($tx))->toBe(100_000);
});

test('an item can be exempted while the shop still charges', function () {
    dendaRule('nominal', 5_000);
    $tx = dendaTransaction(10, ['denda_mode' => 'off', 'denda_value' => 0]);

    expect(LateFee::amount($tx))->toBe(0);
});

test('the shop grace period and cap still apply to an item rule', function () {
    dendaRule('nominal', 1_000, grace: 3, max: 4);
    $tx = dendaTransaction(10, [
        'denda_mode' => 'nominal',
        'denda_value' => 10_000,
    ]);

    // 10 late days, 3 forgiven, capped at 4 chargeable days.
    expect(LateFee::amount($tx))->toBe(40_000);
});

test('a gadai can be created with its own late-fee rule', function () {
    $customer = Customer::create([
        'code' => 'PLG-701', 'name' => 'Sari', 'phone' => '081200000001',
        'join_date' => '2026-01-01',
    ]);

    $this->actingAs(User::factory()->create())->post('/gadai', [
        'code_mode' => 'auto',
        'customer_mode' => 'existing',
        'customer_code' => $customer->code,
        'device_name' => 'iPhone 15',
        'kelengkapan' => 'HP saja',
        'principal' => 1_000_000,
        'tenor_choice' => '15',
        'start_date' => now()->toDateString(),
        'denda_mode' => 'nominal',
        'denda_value' => 7_500,
    ])->assertRedirect();

    $tx = Transaction::latest('id')->first();

    expect($tx->denda_mode)->toBe('nominal')
        ->and((float) $tx->denda_value)->toBe(7_500.0);
});

test('clearing the item rule puts the pawn back on the shop rule', function () {
    dendaRule('nominal', 5_000);
    $customer = Customer::firstOrCreate(
        ['code' => 'PLG-702'],
        ['name' => 'Doni', 'phone' => '081200000002', 'join_date' => '2026-01-01'],
    );
    $tx = dendaTransaction(10, [
        'customer_id' => $customer->id,
        'denda_mode' => 'nominal',
        'denda_value' => 20_000,
    ]);

    $this->actingAs(User::factory()->create())->put("/transaksi/{$tx->code}", [
        'customer_mode' => 'existing',
        'customer_code' => $customer->code,
        'device_name' => $tx->device_name,
        'kelengkapan' => $tx->kelengkapan,
        'status' => 'AKTIF',
        'principal' => $tx->principal,
        'tenor_choice' => '15',
        'start_date' => $tx->start_date->toDateString(),
        'denda_mode' => null,
    ])->assertRedirect();

    $tx->refresh();

    expect($tx->denda_mode)->toBeNull()
        // Back to the shop's 5.000 a day.
        ->and(LateFee::amount($tx))->toBe(50_000);
});

test('an item can carry its own grace period and cap', function () {
    dendaRule('nominal', 1_000, grace: 0, max: 0);
    $tx = dendaTransaction(20, [
        'denda_mode' => 'nominal',
        'denda_value' => 10_000,
        'denda_grace_days' => 5,
        'denda_max_days' => 7,
    ]);

    // 20 late days, 5 forgiven, capped at 7 chargeable days.
    expect(LateFee::amount($tx))->toBe(70_000);
});

test('an item limit left empty still follows the shop', function () {
    dendaRule('nominal', 1_000, grace: 4, max: 6);
    $tx = dendaTransaction(20, [
        'denda_mode' => 'nominal',
        'denda_value' => 10_000,
        'denda_grace_days' => null,
        'denda_max_days' => null,
    ]);

    // Shop's 4-day grace and 6-day cap apply to the item's own rate.
    expect(LateFee::amount($tx))->toBe(60_000);
});

test('a gadai stores its own grace period and cap', function () {
    $customer = Customer::create([
        'code' => 'PLG-703', 'name' => 'Iwan', 'phone' => '081200000003',
        'join_date' => '2026-01-01',
    ]);

    $this->actingAs(User::factory()->create())->post('/gadai', [
        'code_mode' => 'auto',
        'customer_mode' => 'existing',
        'customer_code' => $customer->code,
        'device_name' => 'Redmi 13C',
        'kelengkapan' => 'HP saja',
        'principal' => 1_000_000,
        'tenor_choice' => '15',
        'start_date' => now()->toDateString(),
        'denda_mode' => 'percent_principal',
        'denda_value' => 0.25,
        'denda_grace_days' => 5,
        'denda_max_days' => 20,
    ])->assertRedirect();

    $tx = Transaction::latest('id')->first();

    expect($tx->denda_mode)->toBe('percent_principal')
        ->and((float) $tx->denda_value)->toBe(0.25)
        ->and($tx->denda_grace_days)->toBe(5)
        ->and($tx->denda_max_days)->toBe(20);
});

test('exempting an item clears its rate and limits', function () {
    $customer = Customer::create([
        'code' => 'PLG-704', 'name' => 'Yuni', 'phone' => '081200000004',
        'join_date' => '2026-01-01',
    ]);

    $this->actingAs(User::factory()->create())->post('/gadai', [
        'code_mode' => 'auto',
        'customer_mode' => 'existing',
        'customer_code' => $customer->code,
        'device_name' => 'Oppo A17',
        'kelengkapan' => 'HP saja',
        'principal' => 1_000_000,
        'tenor_choice' => '15',
        'start_date' => now()->toDateString(),
        'denda_mode' => 'off',
        'denda_value' => 9_999,
        'denda_grace_days' => 9,
        'denda_max_days' => 9,
    ])->assertRedirect();

    $tx = Transaction::latest('id')->first();

    expect($tx->denda_mode)->toBe('off')
        ->and($tx->denda_grace_days)->toBeNull()
        ->and($tx->denda_max_days)->toBeNull();
});
