<?php

use App\Models\ActivityLog;
use App\Models\CashEntry;
use App\Models\Customer;
use App\Models\Store;
use App\Models\Transaction;
use App\Models\User;
use Database\Seeders\BiayaOperasionalSeeder;
use Inertia\Testing\AssertableInertia as Assert;

function biayaPayload(array $overrides = []): array
{
    return array_merge([
        'date' => now()->toDateString(),
        'category' => 'listrik',
        'description' => 'Bayar listrik PLN',
        'note' => 'Token 300rb',
        'amount' => 450_000,
        'method' => 'cash',
    ], $overrides);
}

test('an operating cost is recorded and leaves Kas Harian on its own line', function () {
    $this->actingAs(User::factory()->create())
        ->post('/biaya-operasional', biayaPayload())
        ->assertRedirect()
        ->assertSessionHas('success');

    $entry = CashEntry::sole();
    expect($entry->direction)->toBe('out')
        ->and($entry->category)->toBe('listrik')
        ->and($entry->note)->toBe('Token 300rb');

    $today = now()->toDateString();

    $this->actingAs(User::factory()->create())
        ->get("/kas?from={$today}&to={$today}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('cashFlow.out.operasional', 450_000)
            ->where('cashFlow.out.manual', 0)
            ->where('cashFlow.out.total', 450_000)
            ->where('cashFlow.entries.0.kind', 'operasional'),
        );
});

test('a plain manual cash-out is not counted as an operating cost', function () {
    $this->actingAs(User::factory()->create())->post('/kas/manual', [
        'direction' => 'out', 'amount' => 100_000, 'description' => 'Setor ke bank',
        'date' => now()->toDateString(),
    ]);

    $this->get('/biaya-operasional')
        ->assertInertia(fn (Assert $page) => $page
            ->component('biaya-operasional')
            ->has('expenses', 0)
            ->where('summary.total', 0),
        );
});

test('the page lists the period costs with totals per category', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $this->post('/biaya-operasional', biayaPayload(['category' => 'sewa', 'amount' => 1_500_000, 'description' => 'Sewa ruko']));
    $this->post('/biaya-operasional', biayaPayload(['category' => 'atk', 'amount' => 125_000, 'description' => 'Kertas thermal']));
    $this->post('/biaya-operasional', biayaPayload(['category' => 'atk', 'amount' => 25_000, 'description' => 'Plastik segel']));
    // Last month: outside the default period.
    $this->post('/biaya-operasional', biayaPayload(['date' => now()->subMonthNoOverflow()->startOfMonth()->toDateString(), 'amount' => 999_000]));

    $this->get('/biaya-operasional')
        ->assertInertia(fn (Assert $page) => $page
            ->has('expenses', 3)
            ->where('summary.total', 1_650_000)
            ->where('summary.count', 3)
            ->where('summary.byCategory.0.key', 'sewa')
            ->where('summary.byCategory.1.key', 'atk')
            ->where('summary.byCategory.1.total', 150_000)
            ->where('summary.byCategory.1.count', 2),
        );
});

test('an operating cost needs a category, a description and an amount', function () {
    $this->actingAs(User::factory()->create())
        ->post('/biaya-operasional', biayaPayload(['category' => '', 'description' => '', 'amount' => 0]))
        ->assertSessionHasErrors(['category', 'description', 'amount']);

    expect(CashEntry::count())->toBe(0);
});

test('an operating cost cannot be dated in the future', function () {
    $this->actingAs(User::factory()->create())
        ->post('/biaya-operasional', biayaPayload(['date' => now()->addDay()->toDateString()]))
        ->assertSessionHasErrors('date');
});

test('recording and deleting an operating cost is audited, and deleting is flagged', function () {
    $this->actingAs(User::factory()->create(['name' => 'Rina']));

    $this->post('/biaya-operasional', biayaPayload());
    $entry = CashEntry::sole();

    expect(ActivityLog::where('action', 'created')->where('subject_type', 'biaya')->exists())->toBeTrue();

    $this->delete("/biaya-operasional/{$entry->id}")->assertRedirect()->assertSessionHas('success');

    $log = ActivityLog::where('action', 'deleted')->where('subject_type', 'biaya')->sole();
    expect(CashEntry::count())->toBe(0)
        ->and($log->flagged)->toBeTrue()
        ->and($log->actor)->toBe('Rina');
});

test('the kas manual delete cannot bypass the audited path', function () {
    $this->actingAs(User::factory()->create());
    $this->post('/biaya-operasional', biayaPayload());
    $entry = CashEntry::sole();

    $this->delete("/kas/manual/{$entry->id}")->assertSessionHas('error');

    expect(CashEntry::count())->toBe(1);
});

test('a petugas cannot delete another store cost', function () {
    $mine = Store::create(['code' => 'TK-001', 'nota_prefix' => 'GCG', 'name' => 'Toko A', 'active' => true]);
    $theirs = Store::create(['code' => 'TK-002', 'nota_prefix' => 'GCB', 'name' => 'Toko B', 'active' => true]);
    $entry = CashEntry::create([
        'store_id' => $theirs->id, 'entry_date' => now(), 'direction' => 'out',
        'category' => 'sewa', 'amount' => 1_000_000, 'description' => 'Sewa',
    ]);

    $this->actingAs(User::factory()->petugas()->create(['store_id' => $mine->id]))
        ->delete("/biaya-operasional/{$entry->id}")
        ->assertForbidden();

    expect(CashEntry::count())->toBe(1);
});

test('the owner must pick a store before recording a cost', function () {
    Store::create(['code' => 'TK-001', 'nota_prefix' => 'GCG', 'name' => 'Toko A', 'active' => true]);

    $this->actingAs(User::factory()->owner()->create())
        ->post('/biaya-operasional', biayaPayload())
        ->assertSessionHas('error');

    expect(CashEntry::count())->toBe(0);
});

test('the report subtracts operating costs from income for the net profit', function () {
    $customer = Customer::create(['code' => 'PLG-OPS', 'name' => 'Budi', 'phone' => '081200000099', 'join_date' => '2026-01-01']);
    $tx = Transaction::create([
        'code' => 'GCG-OPS-0001', 'customer_id' => $customer->id,
        'device_owner' => 'Budi', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => now()->startOfMonth()->toDateString(), 'due_date' => now()->toDateString(),
        'status' => 'AKTIF', 'approval_status' => 'approved', 'clerk' => 'Rina',
    ]);
    // Income this month: a 300rb extension fee.
    $tx->events()->create(['type' => 'extended', 'event_date' => now()->toDateString(), 'title' => 'P', 'amount' => 300_000]);

    // A forfeited item sold 200rb under its loan.
    $sold = Transaction::create([
        'code' => 'GCG-OPS-0002', 'customer_id' => $customer->id,
        'device_owner' => 'Budi', 'device_name' => 'HP lama', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => now()->startOfMonth()->toDateString(), 'due_date' => now()->toDateString(),
        'status' => 'TIDAK_DIAMBIL', 'approval_status' => 'approved', 'clerk' => 'Rina',
        'sale_value' => 800_000, 'sold_at' => now(),
    ]);

    $owner = User::factory()->owner()->create();
    $this->actingAs($owner)->post('/biaya-operasional', biayaPayload(['amount' => 50_000]));

    $this->get('/laporan')
        ->assertInertia(fn (Assert $page) => $page
            ->where('profit.pendapatan', 300_000)
            ->where('profit.selisihJual', -200_000)
            ->where('profit.terjual', 1)
            ->where('profit.biayaOperasional', 50_000)
            ->where('profit.labaBersih', 50_000),
        );

    expect($sold->exists)->toBeTrue();
});

test('the demo seeder fills three months once and never dates a cost ahead', function () {
    Store::create(['code' => 'TK-001', 'nota_prefix' => 'GCG', 'name' => 'Toko A', 'active' => true]);

    $this->seed(BiayaOperasionalSeeder::class);
    $count = CashEntry::query()->expense()->count();

    $this->seed(BiayaOperasionalSeeder::class);

    expect($count)->toBeGreaterThan(20)
        ->and(CashEntry::query()->expense()->count())->toBe($count)
        ->and(CashEntry::query()->whereDate('entry_date', '>', now()->toDateString())->exists())->toBeFalse()
        ->and(CashEntry::query()->expense()->distinct()->count('category'))->toBe(8);
});
