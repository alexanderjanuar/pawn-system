<?php

namespace Database\Seeders;

use App\Models\Clerk;
use App\Models\Transaction;
use Illuminate\Database\Seeder;

class ClerkSeeder extends Seeder
{
    /**
     * Seed the petugas roster from the clerk names already used on transactions,
     * so existing history stays selectable. Falls back to a couple of defaults.
     */
    public function run(): void
    {
        $names = Transaction::query()
            ->whereNotNull('clerk')
            ->distinct()
            ->orderBy('clerk')
            ->pluck('clerk')
            ->filter();

        if ($names->isEmpty()) {
            $names = collect(['Rina', 'Dedi']);
        }

        foreach ($names as $name) {
            Clerk::query()->firstOrCreate(['name' => $name], ['active' => true]);
        }
    }
}
