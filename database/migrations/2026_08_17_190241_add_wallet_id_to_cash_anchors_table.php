<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cash_anchors', function (Blueprint $table) {
            // Opening balance is now per pocket (wallet).
            $table->foreignId('wallet_id')->nullable()->after('store_id')->index();
        });

        // Existing opening balances belong to the default pocket.
        $defaultId = DB::table('wallets')->where('is_default', true)->value('id');

        if ($defaultId !== null) {
            DB::table('cash_anchors')->whereNull('wallet_id')->update(['wallet_id' => $defaultId]);
        }
    }

    public function down(): void
    {
        Schema::table('cash_anchors', function (Blueprint $table) {
            $table->dropColumn('wallet_id');
        });
    }
};
