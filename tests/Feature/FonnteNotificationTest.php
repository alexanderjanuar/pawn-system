<?php

use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Support\Facades\Http;

function fonnteCustomer(): Customer
{
    return Customer::create([
        'code' => 'PLG-001', 'name' => 'Budi', 'phone' => '0812',
        'address' => 'Jl. A', 'id_number' => '350900', 'join_date' => '2026-07-01',
    ]);
}

function fonntePayload(Customer $customer, int $principal): array
{
    return [
        'code_mode' => 'auto',
        'customer_mode' => 'existing',
        'customer_code' => $customer->code,
        'device_name' => 'iPhone 15',
        'kelengkapan' => 'HP saja',
        'principal' => $principal,
        'tenor_choice' => '15',
        'start_date' => '2026-07-20',
    ];
}

beforeEach(function () {
    config([
        'services.fonnte.token' => 'test-token',
        'services.fonnte.owner_wa' => '081253721672',
    ]);
    Http::fake(['api.fonnte.com/*' => Http::response(['status' => true])]);
});

test('the owner is notified on WhatsApp when a petugas creates a loan above the threshold', function () {
    $customer = fonnteCustomer();

    $this->actingAs(User::factory()->petugas()->create())
        ->post('/gadai', fonntePayload($customer, 10_000_000))
        ->assertRedirect();

    $tx = Transaction::first();

    Http::assertSent(function ($request) use ($tx) {
        return $request->url() === 'https://api.fonnte.com/send'
            && $request['target'] === '081253721672'
            && str_contains($request['message'], $tx->code)
            && str_contains($request['message'], 'Budi');
    });
});

test('no WhatsApp is sent when the loan is at or below the threshold', function () {
    $customer = fonnteCustomer();

    $this->actingAs(User::factory()->petugas()->create())
        ->post('/gadai', fonntePayload($customer, 5_000_000))
        ->assertRedirect();

    Http::assertNothingSent();
});

test('no WhatsApp is sent when management creates a large loan (self-approved)', function () {
    $customer = fonnteCustomer();

    $this->actingAs(User::factory()->owner()->create())
        ->post('/gadai', fonntePayload($customer, 20_000_000))
        ->assertRedirect();

    Http::assertNothingSent();
});

test('no WhatsApp is sent when the Fonnte token is not configured', function () {
    config(['services.fonnte.token' => null]);
    $customer = fonnteCustomer();

    $this->actingAs(User::factory()->petugas()->create())
        ->post('/gadai', fonntePayload($customer, 10_000_000))
        ->assertRedirect();

    Http::assertNothingSent();
});
