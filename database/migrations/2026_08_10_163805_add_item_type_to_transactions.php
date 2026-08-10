<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            // What kind of item is pawned: hp (default) | motor | laptop.
            $table->string('device_type')->default('hp')->after('device_owner');
            // Motor-specific identity (null for hp/laptop).
            $table->string('plat_nomor')->nullable()->after('device_lock_value');
            $table->string('no_rangka')->nullable()->after('plat_nomor');
            $table->string('no_mesin')->nullable()->after('no_rangka');
            $table->string('warna')->nullable()->after('no_mesin');
            $table->string('tahun', 4)->nullable()->after('warna');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropColumn([
                'device_type', 'plat_nomor', 'no_rangka', 'no_mesin', 'warna', 'tahun',
            ]);
        });
    }
};
