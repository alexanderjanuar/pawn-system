<?php

use App\Models\CashEntry;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('a manual expense is recorded and lowers net cash', function () {
    $this->actingAs(User::factory()->create())
        ->post('/kas/manual', [
            'direction' => 'out',
            'amount' => 50_000,
            'description' => 'Beli materai',
            'method' => 'cash',
            'date' => '2026-08-14',
        ])
        ->assertRedirect();

    $entry = CashEntry::sole();
    expect($entry->direction)->toBe('out')
        ->and($entry->amount)->toBe(50_000)
        ->and($entry->description)->toBe('Beli materai');

    $this->actingAs(User::factory()->create())
        ->get('/kas?from=2026-08-14&to=2026-08-14')
        ->assertInertia(fn (Assert $page) => $page
            ->where('cashFlow.out.manual', 50_000)
            ->where('cashFlow.out.total', 50_000)
            ->where('cashFlow.net', -50_000)
        );
});

test('a manual income counts toward masuk and its payment method bucket', function () {
    CashEntry::create([
        'store_id' => null, 'entry_date' => '2026-08-14', 'direction' => 'in',
        'amount' => 200_000, 'description' => 'Setoran tambahan', 'method' => 'transfer', 'by' => 'Atul',
    ]);

    $this->actingAs(User::factory()->create())
        ->get('/kas?from=2026-08-14&to=2026-08-14')
        ->assertInertia(fn (Assert $page) => $page
            ->where('cashFlow.in.manual', 200_000)
            ->where('cashFlow.in.transfer', 200_000)
            ->where('cashFlow.in.total', 200_000)
            ->where('cashFlow.net', 200_000)
        );
});

test('a manual entry can be deleted', function () {
    $entry = CashEntry::create([
        'store_id' => null, 'entry_date' => '2026-08-14', 'direction' => 'out',
        'amount' => 30_000, 'description' => 'Bensin', 'method' => 'cash',
    ]);

    $this->actingAs(User::factory()->create())
        ->delete("/kas/manual/{$entry->id}")
        ->assertRedirect();

    expect(CashEntry::count())->toBe(0);
});

test('a manual entry requires a positive amount and a description', function () {
    $this->actingAs(User::factory()->create())
        ->post('/kas/manual', ['direction' => 'out', 'amount' => 0, 'description' => ''])
        ->assertSessionHasErrors(['amount', 'description']);
});
