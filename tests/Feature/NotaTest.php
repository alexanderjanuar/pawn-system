<?php

use App\Models\Customer;
use App\Models\Rak;
use App\Models\Transaction;
use App\Models\User;
use App\Services\NotaPdf;
use Illuminate\Support\Facades\View;
use Inertia\Testing\AssertableInertia as Assert;

function notaCustomer(): Customer
{
    return Customer::create([
        'code' => 'PLG-030', 'name' => 'Eka', 'phone' => '0812',
        'address' => 'Jl. D', 'id_number' => '999', 'join_date' => '2026-07-01',
    ]);
}

test('the nota entry date stays the original date for a non-extended pawn', function () {
    $customer = notaCustomer();
    $tx = Transaction::create([
        'code' => 'GCG-20260720-0030', 'customer_id' => $customer->id,
        'device_owner' => 'Eka', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => '2026-07-20', 'due_date' => '2026-08-04', 'status' => 'AKTIF',
        'approval_status' => 'approved', 'clerk' => 'Rina', 'extensions' => 0,
    ]);

    $this->actingAs(User::factory()->create())
        ->get("/transaksi/{$tx->code}/nota")
        ->assertInertia(fn (Assert $page) => $page
            ->where('transaction.notaStartDate', '2026-07-20')
            ->where('transaction.dueDate', '2026-08-04'),
        );
});

test('the nota entry date becomes the current period start for an extended pawn', function () {
    $customer = notaCustomer();
    // Extended once: current 30-day period runs 2026-08-04 -> 2026-09-03.
    $tx = Transaction::create([
        'code' => 'GCG-20260720-0031', 'customer_id' => $customer->id,
        'device_owner' => 'Eka', 'device_name' => 'HP', 'kelengkapan' => 'HP saja',
        'principal' => 1_000_000, 'tenor_days' => 30, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => '2026-07-20', 'due_date' => '2026-09-03', 'status' => 'PERPANJANG',
        'approval_status' => 'approved', 'clerk' => 'Rina', 'extensions' => 1,
    ]);

    $this->actingAs(User::factory()->create())
        ->get("/transaksi/{$tx->code}/nota")
        ->assertInertia(fn (Assert $page) => $page
            ->where('transaction.notaStartDate', '2026-08-04')
            ->where('transaction.dueDate', '2026-09-03'),
        );
});

/**
 * A nota with every optional block filled in: rak, unlock pattern, notes and
 * a long address — the tallest nota a clerk can realistically print.
 */
function fullNota(string $rakName): Transaction
{
    $customer = Customer::create([
        'code' => 'PLG-032', 'name' => 'Eka Saputra', 'phone' => '081234567890',
        'address' => 'Jl. Serayu Tanah Merah Gang Mawar No. 12 RT 03 / RW 07, Kelurahan Tanah Merah, Kecamatan Kota',
        'id_number' => '999', 'join_date' => '2026-07-01',
    ]);
    $rak = Rak::create(['name' => $rakName, 'capacity' => 12, 'active' => true]);

    return Transaction::create([
        'code' => 'GCG-20260720-0032', 'customer_id' => $customer->id, 'rak_id' => $rak->id,
        'device_owner' => 'Eka Saputra', 'device_name' => 'Samsung Galaxy A55 5G 8/256', 'kelengkapan' => 'HP, dus, charger',
        'device_serial' => 'R58W123ABCD', 'device_lock_type' => 'pattern', 'device_lock_value' => '1-2-3-5-7-8-9',
        'notes' => 'Layar ada goresan tipis di pojok kanan atas, baterai normal, kamera belakang berfungsi baik.',
        'principal' => 1_000_000, 'tenor_days' => 15, 'fee_percent' => 10, 'fee' => 100_000,
        'start_date' => '2026-07-20', 'due_date' => '2026-08-04', 'status' => 'AKTIF',
        'approval_status' => 'approved', 'clerk' => 'Rina', 'extensions' => 0,
    ]);
}

test('the nota shows the rack the item is stored on', function () {
    $tx = fullNota('Rak A');

    $this->actingAs(User::factory()->create())
        ->get("/transaksi/{$tx->code}/nota")
        ->assertInertia(fn (Assert $page) => $page->where('transaction.rak', 'Rak A'));
});

test('the nota PDF prints the rack without repeating the word', function (string $rakName, string $printed) {
    $captured = null;
    View::composer('pdf.nota', function ($view) use (&$captured) {
        $captured = $view->getData()['n'];
    });

    app(NotaPdf::class)->make(fullNota($rakName))->output();

    expect($captured['rak'])->toBe($printed);
})->with([
    'rak prefix' => ['Rak A', 'A'],
    'uppercase prefix' => ['RAK-12', '12'],
    'no prefix' => ['Lemari 2', 'Lemari 2'],
    'just the word' => ['Rak', 'Rak'],
]);

test('the nota PDF with a rack still fits on one page', function () {
    $pdf = app(NotaPdf::class)->make(fullNota('Rak A'));
    $pdf->output();

    expect($pdf->getDomPDF()->getCanvas()->get_page_count())->toBe(1);
});
