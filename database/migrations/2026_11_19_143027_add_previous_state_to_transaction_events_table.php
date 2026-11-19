<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * What the transaction looked like right before this event changed it,
     * so a mistaken redemption can be undone exactly:
     * { "status": "PERPANJANG", "fee": 50000, "fee_percent": 5, "denda": 0 }.
     */
    public function up(): void
    {
        Schema::table('transaction_events', function (Blueprint $table) {
            $table->json('previous_state')->nullable()->after('wallet_split');
        });
    }

    public function down(): void
    {
        Schema::table('transaction_events', function (Blueprint $table) {
            $table->dropColumn('previous_state');
        });
    }
};
