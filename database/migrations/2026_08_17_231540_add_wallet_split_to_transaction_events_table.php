<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transaction_events', function (Blueprint $table) {
            // Optional split of a disbursement across pockets:
            // [{ "wallet_id": 1, "amount": 900000 }, { "wallet_id": 2, "amount": 100000 }].
            // Null = the whole amount belongs to `wallet_id`.
            $table->json('wallet_split')->nullable()->after('wallet_id');
        });
    }

    public function down(): void
    {
        Schema::table('transaction_events', function (Blueprint $table) {
            $table->dropColumn('wallet_split');
        });
    }
};
