<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Grace period and cap for an item that carries its own late-fee rule.
     * Null falls back to the shop-wide setting.
     */
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->unsignedSmallInteger('denda_grace_days')->nullable()->after('denda_value');
            $table->unsignedSmallInteger('denda_max_days')->nullable()->after('denda_grace_days');
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropColumn(['denda_grace_days', 'denda_max_days']);
        });
    }
};
