<?php

use App\Models\ActivityLog;
use App\Models\Customer;
use App\Models\Rak;
use App\Models\Store;
use App\Models\Transaction;
use App\Models\User;
use Inertia\Testing\AssertableInertia;

beforeEach(function () {
    Store::create(['code' => 'TK-001', 'name' => 'Toko A', 'active' => true]); // id 1
    Store::create(['code' => 'TK-002', 'name' => 'Toko B', 'active' => true]); // id 2
});

function rakMoveTx(?int $rakId, string $code = 'GCG-RAK-001'): Transaction
{
    $customer = Customer::create([
        'code' => 'PLG-RAK-'.$code, 'name' => 'Rina', 'phone' => '0812', 'join_date' => '2026-07-01',
    ]);

    return Transaction::create([
        'code' => $code, 'customer_id' => $customer->id, 'store_id' => 1, 'rak_id' => $rakId,
        'device_owner' => 'Rina', 'device_name' => 'iPhone 13', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => '2026-08-14', 'due_date' => '2026-08-29', 'status' => 'AKTIF',
        'approval_status' => 'approved', 'clerk' => 'Atul',
    ]);
}

test('a phone can be moved to another rack and the change is logged', function () {
    $a = Rak::create(['store_id' => 1, 'name' => 'Rak A', 'active' => true]);
    $b = Rak::create(['store_id' => 1, 'name' => 'Rak B', 'active' => true]);
    $tx = rakMoveTx($a->id);

    $this->actingAs(User::factory()->create())
        ->put("/rak/pindah/{$tx->code}", ['rak_id' => $b->id])
        ->assertRedirect()
        ->assertSessionHas('success');

    expect($tx->refresh()->rak_id)->toBe($b->id);

    $log = ActivityLog::where('subject_code', $tx->code)->where('action', 'updated')->latest('id')->first();
    expect($log?->description)->toContain('Memindahkan rak')
        ->and($log?->changes)->toBe([['field' => 'Rak', 'from' => 'Rak A', 'to' => 'Rak B']]);
});

test('a phone can be taken off a rack', function () {
    $a = Rak::create(['store_id' => 1, 'name' => 'Rak A', 'active' => true]);
    $tx = rakMoveTx($a->id);

    $this->actingAs(User::factory()->create())
        ->put("/rak/pindah/{$tx->code}", ['rak_id' => null])
        ->assertRedirect();

    expect($tx->refresh()->rak_id)->toBeNull();
});

test('a phone cannot be moved to a rack in a different store', function () {
    $a = Rak::create(['store_id' => 1, 'name' => 'Rak A', 'active' => true]);
    $other = Rak::create(['store_id' => 2, 'name' => 'Rak Lain', 'active' => true]);
    $tx = rakMoveTx($a->id);

    $this->actingAs(User::factory()->create())
        ->put("/rak/pindah/{$tx->code}", ['rak_id' => $other->id])
        ->assertRedirect()
        ->assertSessionHas('error');

    expect($tx->refresh()->rak_id)->toBe($a->id); // unchanged
});

test('every phone on a rack can be moved at once', function () {
    $a = Rak::create(['store_id' => 1, 'name' => 'Rak A', 'active' => true]);
    $b = Rak::create(['store_id' => 1, 'name' => 'Rak B', 'active' => true]);
    $one = rakMoveTx($a->id, 'GCG-RAK-101');
    $two = rakMoveTx($a->id, 'GCG-RAK-102');
    // Already redeemed, so it is no longer on the shelf and must not move.
    $gone = rakMoveTx($a->id, 'GCG-RAK-103');
    $gone->update(['status' => 'DIAMBIL']);

    $this->actingAs(User::factory()->owner()->create())
        ->put("/rak/{$a->id}/pindah-semua", ['rak_id' => $b->id])
        ->assertRedirect()
        ->assertSessionHas('success');

    expect($one->refresh()->rak_id)->toBe($b->id)
        ->and($two->refresh()->rak_id)->toBe($b->id)
        ->and($gone->refresh()->rak_id)->toBe($a->id);

    // Each phone keeps its own audit entry.
    expect(ActivityLog::where('description', 'Memindahkan rak: Rak A → Rak B')->count())->toBe(2);
});

test('moving a whole rack to another store is refused', function () {
    $a = Rak::create(['store_id' => 1, 'name' => 'Rak A', 'active' => true]);
    $other = Rak::create(['store_id' => 2, 'name' => 'Rak B', 'active' => true]);
    $tx = rakMoveTx($a->id, 'GCG-RAK-104');

    $this->actingAs(User::factory()->owner()->create())
        ->put("/rak/{$a->id}/pindah-semua", ['rak_id' => $other->id])
        ->assertRedirect()
        ->assertSessionHas('error');

    expect($tx->refresh()->rak_id)->toBe($a->id);
});

test('clearing an empty rack reports nothing to move', function () {
    $a = Rak::create(['store_id' => 1, 'name' => 'Rak A', 'active' => true]);

    $this->actingAs(User::factory()->owner()->create())
        ->put("/rak/{$a->id}/pindah-semua", ['rak_id' => null])
        ->assertRedirect()
        ->assertSessionHas('error');
});

test('petugas cannot clear a whole rack', function () {
    $a = Rak::create(['store_id' => 1, 'name' => 'Rak A', 'active' => true]);
    rakMoveTx($a->id, 'GCG-RAK-105');

    $this->actingAs(User::factory()->petugas()->create(['store_id' => 1]))
        ->put("/rak/{$a->id}/pindah-semua", ['rak_id' => null])
        ->assertForbidden();
});

test('the rak page flags phones that are past due', function () {
    $a = Rak::create(['store_id' => 1, 'name' => 'Rak A', 'active' => true]);
    $late = rakMoveTx($a->id, 'GCG-RAK-106');
    $late->update(['due_date' => now()->subDays(3)]);
    $ontime = rakMoveTx($a->id, 'GCG-RAK-107');
    $ontime->update(['due_date' => now()->addDays(10)]);

    $this->actingAs(User::factory()->owner()->create())
        ->withSession(['active_store_id' => 1])
        ->get('/rak')
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('rak/index')
            ->where('racks.0.overdueCount', 1)
            ->where('racks.0.items.0.overdue', true)
            ->where('racks.0.items.1.overdue', false),
        );
});

test('a rack label page can be printed', function () {
    $a = Rak::create(['store_id' => 1, 'name' => 'Rak A', 'capacity' => 12, 'active' => true]);
    rakMoveTx($a->id, 'GCG-RAK-108');

    $this->actingAs(User::factory()->create())
        ->get("/rak/{$a->id}/label")
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('rak/label')
            ->where('rak.name', 'Rak A')
            ->where('rak.capacity', 12)
            ->where('rak.count', 1),
        );
});
