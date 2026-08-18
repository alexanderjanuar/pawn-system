<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wallets', function (Blueprint $table) {
            // A source/destination "pocket" for cash: the shop's own money, a
            // lender's (e.g. Kak Gulam), etc. Used to split the cash balance.
            $table->id();
            $table->string('name');
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
        });

        // Seed the two default pockets so the feature works out of the box.
        $now = now();
        DB::table('wallets')->insert([
            ['name' => 'Toko', 'is_default' => true, 'is_active' => true, 'sort' => 0, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Kak Gulam', 'is_default' => false, 'is_active' => true, 'sort' => 1, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('wallets');
    }
};
