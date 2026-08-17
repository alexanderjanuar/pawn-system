<?php

use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use App\Services\Fonnte;
use Illuminate\Support\Facades\Http;

function notaSendCustomer(string $phone = '0812-3344-5566'): Customer
{
    return Customer::create([
        'code' => 'PLG-900', 'name' => 'Budi', 'phone' => $phone,
        'address' => 'Jl. Serayu', 'id_number' => '3509', 'join_date' => '2026-07-01',
    ]);
}

function approvedNota(Customer $customer): Transaction
{
    $tx = Transaction::create([
        'code' => 'GCG-20260814-0900', 'customer_id' => $customer->id,
        'device_owner' => 'Budi', 'device_name' => 'iPhone 12', 'kelengkapan' => 'HP saja',
        'device_lock_type' => 'pattern', 'device_lock_value' => '1-2-3-6-9',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => '2026-08-14', 'due_date' => '2026-08-29', 'status' => 'AKTIF',
        'approval_status' => 'approved', 'clerk' => 'Atul', 'notes' => 'Titip charger', 'extensions' => 0,
    ]);
    $tx->events()->create(['type' => 'created', 'event_date' => '2026-08-14', 'title' => 'Gadai masuk', 'by' => 'Atul', 'amount' => 1_000_000]);

    return $tx;
}

test('the nota is sent to WhatsApp as a short link', function () {
    $this->app->instance(Fonnte::class, new Fonnte('test-token'));

    $tx = approvedNota(notaSendCustomer());

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/kirim-nota", ['message' => 'Halo Budi, ini nota Anda.'])
        ->assertRedirect()
        ->assertSessionHas('success');

    // A stable share token was generated and the message carried its /n/ link.
    $token = $tx->fresh()->share_token;
    expect($token)->not->toBeNull();
    Http::assertSent(fn ($request) => str_contains($request->url(), 'api.fonnte.com')
        && str_contains($request->data()['message'] ?? '', "/n/{$token}")
        && ! isset($request->data()['url']));

    expect($tx->events()->where('type', 'nota_sent')->first()?->title)->toContain('link');
});

test('sending the nota fails clearly when the customer has no phone', function () {
    $this->app->instance(Fonnte::class, new Fonnte('test-token'));

    $tx = approvedNota(notaSendCustomer(''));

    $this->actingAs(User::factory()->create())
        ->post("/transaksi/{$tx->code}/kirim-nota", [])
        ->assertRedirect()
        ->assertSessionHas('error');

    expect($tx->events()->where('type', 'nota_sent')->count())->toBe(0);
});

test('the public nota link streams a PDF to guests', function () {
    $tx = approvedNota(notaSendCustomer());
    $token = $tx->shareToken();

    $response = $this->get("/n/{$token}");

    $response->assertOk();
    expect($response->headers->get('content-type'))->toContain('application/pdf')
        ->and(substr((string) $response->getContent(), 0, 5))->toBe('%PDF-');
});

test('an unknown nota token returns 404', function () {
    $this->get('/n/doesnotexist')->assertNotFound();
});

test('creating a gadai with kirim_wa hands the nota link to the customer', function () {
    $this->app->instance(Fonnte::class, new Fonnte('test-token'));
    $customer = notaSendCustomer();

    $this->actingAs(User::factory()->create())
        ->post('/gadai', [
            'customer_mode' => 'existing',
            'customer_code' => $customer->code,
            'device_name' => 'iPhone 15',
            'kelengkapan' => 'HP saja',
            'principal' => 1_000_000,
            'tenor_choice' => '15',
            'start_date' => '2026-08-14',
            'kirim_wa' => 1,
        ])
        ->assertRedirect();

    $tx = Transaction::first();
    expect($tx)->not->toBeNull()
        ->and($tx->share_token)->not->toBeNull()
        ->and($tx->events()->where('type', 'nota_sent')->count())->toBe(1);

    Http::assertSent(fn ($request) => str_contains($request->url(), 'api.fonnte.com'));
});
