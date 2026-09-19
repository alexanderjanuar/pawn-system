<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * An optional late-fee rule for one item, overriding the shop-wide one.
     * Null means "follow the shop rule", which is what almost every pawn does.
     */
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->string('denda_mode')->nullable()->after('denda');
            $table->decimal('denda_value', 14, 2)->nullable()->after('denda_mode');
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropColumn(['denda_mode', 'denda_value']);
        });
    }
};
