<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::factory()->create([
            'name' => 'Admin Sistem',
            'email' => 'admin@gulamcell.test',
            'password' => 'password',
            'role' => Role::Admin,
        ]);

        User::factory()->create([
            'name' => 'Pemilik Gulam Cell',
            'email' => 'owner@gulamcell.test',
            'password' => 'password',
            'role' => Role::Owner,
        ]);

        User::factory()->create([
            'name' => 'Petugas Counter',
            'email' => 'petugas@gulamcell.test',
            'password' => 'password',
            'role' => Role::Petugas,
        ]);

        $this->call(GadaiSeeder::class);
        $this->call(ClerkSeeder::class);
        $this->call(StoreSeeder::class);
        $this->call(RakSeeder::class);
    }
}
