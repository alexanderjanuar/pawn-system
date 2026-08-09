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
            // How the pawned phone is unlocked, so the shop can access it.
            // Type: none | pin | password | pattern. Value holds the PIN,
            // password, or the pattern sequence (e.g. "1-2-3-6-9").
            $table->string('device_lock_type')->default('none')->after('imei_2');
            $table->string('device_lock_value')->nullable()->after('device_lock_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropColumn(['device_lock_type', 'device_lock_value']);
        });
    }
};
