<?php

namespace Database\Seeders;

use App\Models\CashEntry;
use App\Models\Clerk;
use App\Models\Store;
use App\Models\Wallet;
use Carbon\CarbonInterface;
use Illuminate\Database\Seeder;

class BiayaOperasionalSeeder extends Seeder
{
    /**
     * Three months of believable shop running costs per store, so the
     * Biaya Operasional page, Kas Harian and the Laba Bersih report have
     * something to show. Amounts vary a little month to month but are fixed,
     * so the totals are the same on every run.
     */
    public function run(): void
    {
        // Fake costs would change a real shop's cash book and profit.
        if (app()->isProduction() || CashEntry::query()->expense()->exists()) {
            return;
        }

        $stores = Store::query()->orderBy('id')->get();
        $walletId = Wallet::defaultId();
        $today = now()->startOfDay();

        foreach ($stores->isEmpty() ? [null] : $stores->all() as $store) {
            $clerks = Clerk::query()
                ->when($store !== null, fn ($q) => $q->where('store_id', $store->id))
                ->pluck('name')
                ->values()
                ->all() ?: ['Petugas Counter'];

            for ($back = 2; $back >= 0; $back--) {
                $month = $today->copy()->startOfMonth()->subMonthsNoOverflow($back);
                $wobble = [0, 1, -1][$back]; // small month-to-month change

                foreach ($this->monthPlan($month, $wobble, $clerks) as [$day, $category, $description, $note, $amount, $method, $by]) {
                    $date = $month->copy()->day(min($day, $month->daysInMonth));

                    // The running month only has what has already been paid.
                    if ($date->gt($today)) {
                        continue;
                    }

                    CashEntry::create([
                        'store_id' => $store?->id,
                        'entry_date' => $date,
                        'direction' => 'out',
                        'category' => $category,
                        'amount' => $amount,
                        'description' => $description,
                        'note' => $note,
                        'method' => $method,
                        'by' => $by,
                        'wallet_id' => $walletId,
                    ]);
                }
            }
        }
    }

    /**
     * One month of costs: [day, category, description, note, amount, method, recorded by].
     *
     * @param  list<string>  $clerks
     * @return list<array{0: int, 1: string, 2: string, 3: string|null, 4: int, 5: string, 6: string}>
     */
    private function monthPlan(CarbonInterface $month, int $wobble, array $clerks): array
    {
        $name = $month->locale('id')->translatedFormat('F');
        $owner = 'Pemilik Gulam Cell';
        $a = $clerks[0];
        $b = $clerks[1] ?? $clerks[0];

        $plan = [
            [1, 'sewa', "Sewa ruko {$name}", 'Dibayar ke pemilik ruko', 1_500_000, 'transfer', $owner],
            [1, 'lainnya', "Iuran keamanan & kebersihan {$name}", 'Iuran RT', 75_000, 'cash', $a],
            [4, 'listrik', 'Token listrik PLN', 'Token 300rb', 300_000 + $wobble * 50_000, 'cash', $a],
            [6, 'atk', 'Kertas thermal 58mm', '10 roll', 125_000, 'cash', $b],
            [8, 'konsumsi', 'Galon & kopi toko', null, 45_000 + $wobble * 5_000, 'cash', $a],
            [10, 'listrik', 'Internet Indihome', "Tagihan {$name}", 350_000, 'transfer', $owner],
            [12, 'transport', 'Bensin antar barang ke cabang', null, 50_000, 'cash', $b],
            [15, 'atk', 'Plastik segel & label rak', null, 65_000 + $wobble * 10_000, 'cash', $a],
            [16, 'konsumsi', 'Uang makan petugas', '2 orang', 120_000, 'cash', $b],
            [20, 'listrik', 'Token listrik PLN', 'Token 200rb', 200_000, 'cash', $b],
            [22, 'transport', 'Ongkos kirim nota & berkas', null, 35_000, 'cash', $a],
            [25, 'gaji', "Gaji {$a} {$name}", null, 2_000_000, 'transfer', $owner],
        ];

        if ($b !== $a) {
            $plan[] = [25, 'gaji', "Gaji {$b} {$name}", null, 2_000_000, 'transfer', $owner];
        }

        // One-off repairs land in different months.
        $plan[] = match ($wobble) {
            1 => [18, 'perawatan', 'Servis AC toko', 'Isi freon + cuci', 250_000, 'cash', $owner],
            -1 => [9, 'perawatan', 'Ganti kunci etalase', null, 85_000, 'cash', $a],
            default => [14, 'perawatan', 'Perbaikan lampu & stop kontak', null, 60_000, 'cash', $b],
        };

        return $plan;
    }
}
