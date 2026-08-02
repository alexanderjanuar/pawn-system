<?php

namespace Database\Seeders;

use App\Models\Rak;
use App\Models\Store;
use App\Models\Transaction;
use Illuminate\Database\Seeder;

class RakSeeder extends Seeder
{
    /**
     * Seed a few demo racks for the default store and place some held phones on
     * them so the rack page has content to show.
     */
    public function run(): void
    {
        $store = Store::query()->orderBy('id')->first();

        if (! $store) {
            return;
        }

        $racks = collect([
            ['name' => 'Rak A', 'capacity' => 12],
            ['name' => 'Rak B', 'capacity' => 12],
            ['name' => 'Rak C', 'capacity' => null],
        ])->map(fn (array $data): Rak => Rak::firstOrCreate(
            ['store_id' => $store->id, 'name' => $data['name']],
            ['capacity' => $data['capacity'], 'active' => true],
        ));

        // Distribute the store's held phones across the racks (demo only).
        Transaction::query()
            ->held()
            ->where('store_id', $store->id)
            ->whereNull('rak_id')
            ->orderBy('id')
            ->get()
            ->each(function (Transaction $t, int $i) use ($racks): void {
                $t->update(['rak_id' => $racks[$i % $racks->count()]->id]);
            });
    }
}
