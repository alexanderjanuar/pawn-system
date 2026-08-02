<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * Seed the default login accounts. Idempotent: re-running keeps the same
     * accounts and resets their credentials. Petugas are pinned to a store by
     * StoreSeeder after stores exist.
     */
    public function run(): void
    {
        $accounts = [
            ['name' => 'Admin Sistem', 'email' => 'admin@gulamcell.test', 'role' => Role::Admin],
            ['name' => 'Pemilik Gulam Cell', 'email' => 'owner@gulamcell.test', 'role' => Role::Owner],
            ['name' => 'Petugas Counter', 'email' => 'petugas@gulamcell.test', 'role' => Role::Petugas],
        ];

        foreach ($accounts as $account) {
            User::updateOrCreate(
                ['email' => $account['email']],
                [
                    'name' => $account['name'],
                    'role' => $account['role'],
                    'password' => 'password',
                    'active' => true,
                    'email_verified_at' => now(),
                ],
            );
        }
    }
}
