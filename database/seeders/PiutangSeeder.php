<?php

namespace Database\Seeders;

use App\Models\Piutang;
use App\Models\Store;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class PiutangSeeder extends Seeder
{
    /**
     * Seed a couple of demo piutang (credit phones) with some payments.
     */
    public function run(): void
    {
        $store = Store::query()->orderBy('id')->first();

        if (! $store || Piutang::query()->exists()) {
            return;
        }

        $date = Carbon::parse('2026-07-25');

        $a = Piutang::create([
            'store_id' => $store->id,
            'code' => Piutang::nextCode($store, $date),
            'debtor_name' => 'Rina',
            'device_name' => 'Redmi 13C',
            'price' => 1_800_000,
            'date' => $date,
            'status' => 'berjalan',
            'clerk' => 'Rina',
            'notes' => 'Cicil per bulan.',
        ]);
        $a->generateTermins(3, $a->date);
        $a->payments()->create(['amount' => 500_000, 'paid_at' => '2026-07-28', 'by' => 'Petugas Counter']);
        $a->payments()->create(['amount' => 300_000, 'paid_at' => '2026-08-01', 'by' => 'Petugas Counter']);
        $a->syncStatus();

        $b = Piutang::create([
            'store_id' => $store->id,
            'code' => Piutang::nextCode($store, $date),
            'debtor_name' => 'Dedi',
            'device_name' => 'Samsung A05',
            'price' => 1_500_000,
            'date' => $date,
            'status' => 'berjalan',
            'clerk' => 'Dedi',
        ]);
        $b->payments()->create(['amount' => 1_500_000, 'paid_at' => '2026-07-30', 'by' => 'Pemilik Gulam Cell']);
        $b->syncStatus();
    }
}
