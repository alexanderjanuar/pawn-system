<?php

use App\Models\ActivityLog;
use App\Models\Customer;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function reviewCustomer(): Customer
{
    return Customer::firstOrCreate(
        ['code' => 'PLG-500'],
        ['name' => 'Budi', 'phone' => '081200000000', 'join_date' => '2026-07-01'],
    );
}

function reviewTransaction(array $overrides = []): Transaction
{
    return Transaction::create(array_merge([
        'code' => 'GCG-20260801-0500', 'customer_id' => reviewCustomer()->id,
        'device_owner' => 'Budi', 'device_name' => 'iPhone 13', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => '2026-08-01', 'due_date' => '2026-08-16', 'status' => 'AKTIF',
        'approval_status' => 'approved', 'clerk' => 'Rina', 'extensions' => 0,
    ], $overrides));
}

test('a discount beyond the allowed share is flagged for the owner', function () {
    Setting::put('max_discount_percent', 10);
    $tx = reviewTransaction();

    // 100rb → 50rb is a 50% cut, well over the 10% a petugas may give.
    $this->actingAs(User::factory()->petugas()->create())
        ->post("/transaksi/{$tx->code}/tebus", [
            'fee' => 50_000,
            'reason' => 'Diskon khusus',
        ])->assertRedirect();

    $log = ActivityLog::where('subject_code', $tx->code)->latest('id')->first();
    expect($log?->flagged)->toBeTrue()
        ->and($log?->reviewed_at)->toBeNull();
});

test('a discount within the allowed share is not flagged', function () {
    Setting::put('max_discount_percent', 10);
    $tx = reviewTransaction();

    // 100rb → 95rb is a 5% cut.
    $this->actingAs(User::factory()->petugas()->create())
        ->post("/transaksi/{$tx->code}/tebus", [
            'fee' => 95_000,
            'reason' => 'Pembulatan',
        ])->assertRedirect();

    expect(ActivityLog::where('subject_code', $tx->code)->latest('id')->first()?->flagged)->toBeFalse();
});

test('the owner is not limited by the discount rule', function () {
    Setting::put('max_discount_percent', 10);
    $tx = reviewTransaction();

    $this->actingAs(User::factory()->owner()->create())
        ->post("/transaksi/{$tx->code}/tebus", [
            'fee' => 10_000,
            'reason' => 'Kebijakan pemilik',
        ])->assertRedirect();

    expect(ActivityLog::where('subject_code', $tx->code)->latest('id')->first()?->flagged)->toBeFalse();
});

test('the limit can be switched off entirely', function () {
    Setting::put('max_discount_percent', 0);
    $tx = reviewTransaction();

    $this->actingAs(User::factory()->petugas()->create())
        ->post("/transaksi/{$tx->code}/tebus", [
            'fee' => 0,
            'reason' => 'Gratis',
        ])->assertRedirect();

    expect(ActivityLog::where('subject_code', $tx->code)->latest('id')->first()?->flagged)->toBeFalse();
});

test('cancelling an extension is flagged', function () {
    $tx = reviewTransaction(['status' => 'PERPANJANG', 'due_date' => '2026-08-31', 'extensions' => 1]);
    $tx->events()->create([
        'type' => 'extended', 'event_date' => '2026-08-16', 'title' => 'Perpanjang', 'amount' => 100_000,
    ]);
    ActivityLog::create([
        'actor' => 'Rina', 'action' => 'updated', 'subject_type' => 'transaction',
        'subject_code' => $tx->code, 'subject_label' => 'Budi',
        'description' => 'Memperpanjang s/d 2026-08-31',
    ]);

    $this->actingAs(User::factory()->owner()->create())
        ->post("/transaksi/{$tx->code}/perpanjang/batal")
        ->assertRedirect();

    $log = ActivityLog::where('description', 'like', 'Membatalkan perpanjangan%')->first();
    expect($log?->flagged)->toBeTrue();
});

test('deleting a transaction is flagged', function () {
    $tx = reviewTransaction();

    $this->actingAs(User::factory()->owner()->create())
        ->delete("/transaksi/{$tx->code}")
        ->assertRedirect();

    expect(ActivityLog::where('description', 'Menghapus transaksi')->first()?->flagged)->toBeTrue();
});

test('the dashboard shows what still needs the owner attention', function () {
    $owner = User::factory()->owner()->create();
    ActivityLog::create([
        'actor' => 'Rina', 'action' => 'updated', 'subject_type' => 'transaction',
        'subject_code' => 'GCG-1', 'subject_label' => 'Budi',
        'description' => 'Membatalkan lelang', 'flagged' => true,
    ]);
    ActivityLog::create([
        'actor' => 'Rina', 'action' => 'created', 'subject_type' => 'transaction',
        'subject_code' => 'GCG-2', 'subject_label' => 'Sari', 'description' => 'Membuat transaksi',
    ]);

    $this->actingAs($owner)
        ->get('/dashboard')
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('reviewCount', 1)
            ->has('reviewQueue', 1)
            ->where('reviewQueue.0.subjectCode', 'GCG-1')
            ->where('reviewQueue.0.flagged', true),
        );
});

test('marking an entry reviewed clears it from the queue', function () {
    $owner = User::factory()->owner()->create(['name' => 'Pemilik']);
    $log = ActivityLog::create([
        'actor' => 'Rina', 'action' => 'updated', 'subject_type' => 'transaction',
        'subject_code' => 'GCG-1', 'subject_label' => 'Budi',
        'description' => 'Membatalkan lelang', 'flagged' => true,
    ]);

    $this->actingAs($owner)->post("/aktivitas/{$log->id}/tinjau")->assertRedirect();

    expect($log->fresh()->reviewed_at)->not->toBeNull()
        ->and($log->fresh()->reviewed_by)->toBe('Pemilik');

    $this->actingAs($owner)
        ->get('/dashboard')
        ->assertInertia(fn (Assert $page) => $page->where('reviewCount', 0));
});

test('the whole queue can be cleared at once', function () {
    $owner = User::factory()->owner()->create();

    foreach (['GCG-1', 'GCG-2', 'GCG-3'] as $code) {
        ActivityLog::create([
            'actor' => 'Rina', 'action' => 'updated', 'subject_type' => 'transaction',
            'subject_code' => $code, 'subject_label' => 'Budi',
            'description' => 'Membatalkan lelang', 'flagged' => true,
        ]);
    }

    $this->actingAs($owner)->post('/aktivitas/tinjau-semua')->assertRedirect();

    expect(ActivityLog::whereNull('reviewed_at')->where('flagged', true)->count())->toBe(0);
});

test('the aktivitas log can be narrowed to what needs review', function () {
    $owner = User::factory()->owner()->create();
    ActivityLog::create([
        'actor' => 'Rina', 'action' => 'updated', 'subject_type' => 'transaction',
        'subject_code' => 'GCG-1', 'subject_label' => 'Budi',
        'description' => 'Membatalkan lelang', 'flagged' => true,
    ]);
    ActivityLog::create([
        'actor' => 'Rina', 'action' => 'created', 'subject_type' => 'transaction',
        'subject_code' => 'GCG-2', 'subject_label' => 'Sari', 'description' => 'Membuat transaksi',
    ]);

    $this->actingAs($owner)
        ->get('/aktivitas?flagged=1')
        ->assertInertia(fn (Assert $page) => $page
            ->has('activities', 1)
            ->where('activities.0.subjectCode', 'GCG-1')
            ->where('total', 1),
        );
});

test('petugas cannot clear the owner review queue', function () {
    $log = ActivityLog::create([
        'actor' => 'Rina', 'action' => 'updated', 'subject_type' => 'transaction',
        'subject_code' => 'GCG-1', 'subject_label' => 'Budi',
        'description' => 'Membatalkan lelang', 'flagged' => true,
    ]);

    $this->actingAs(User::factory()->petugas()->create())
        ->post("/aktivitas/{$log->id}/tinjau")
        ->assertForbidden();

    expect($log->fresh()->reviewed_at)->toBeNull();
});
