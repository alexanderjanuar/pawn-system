<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\ActivityLog;
use App\Models\Clerk;
use App\Models\Store;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Database\Seeder;

class StoreSeeder extends Seeder
{
    /**
     * Create the default store and backfill existing transactions, petugas and
     * petugas accounts to it. Management accounts stay null (access all stores).
     */
    public function run(): void
    {
        $store = Store::firstOrCreate(
            ['code' => 'TK-001'],
            ['name' => 'Gulam Cell II', 'nota_prefix' => 'GCG', 'active' => true],
        );

        // Preserve the existing nota prefix on the original store.
        if ($store->nota_prefix === null) {
            $store->update(['nota_prefix' => 'GCG']);
        }

        Transaction::query()->whereNull('store_id')->update(['store_id' => $store->id]);
        Clerk::query()->whereNull('store_id')->update(['store_id' => $store->id]);
        ActivityLog::query()->whereNull('store_id')->update(['store_id' => $store->id]);
        User::query()
            ->whereNull('store_id')
            ->where('role', Role::Petugas->value)
            ->update(['store_id' => $store->id]);
    }
}
