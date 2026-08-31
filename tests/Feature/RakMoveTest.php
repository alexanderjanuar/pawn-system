<?php

use App\Models\ActivityLog;
use App\Models\Customer;
use App\Models\Rak;
use App\Models\Store;
use App\Models\Transaction;
use App\Models\User;

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
