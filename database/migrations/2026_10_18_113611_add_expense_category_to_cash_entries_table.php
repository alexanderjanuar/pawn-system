<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A shop operating cost (rent, electricity, wages) is money leaving the
     * drawer like any manual cash-out, so it lives with the manual entries and
     * flows into Kas Harian unchanged. The category is what sets it apart and
     * lets the report subtract it from income.
     */
    public function up(): void
    {
        Schema::table('cash_entries', function (Blueprint $table) {
            $table->string('category')->nullable()->after('direction');
            $table->string('note')->nullable()->after('description');
            $table->index(['category', 'entry_date']);
        });
    }

    public function down(): void
    {
        Schema::table('cash_entries', function (Blueprint $table) {
            $table->dropIndex(['category', 'entry_date']);
            $table->dropColumn(['category', 'note']);
        });
    }
};
