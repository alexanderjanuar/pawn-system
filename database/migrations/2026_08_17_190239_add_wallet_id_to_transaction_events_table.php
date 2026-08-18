<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transaction_events', function (Blueprint $table) {
            // Which pocket funded (pencairan) or received (tebus/perpanjang/lelang) the money.
            $table->foreignId('wallet_id')->nullable()->after('payment_method')->index();
        });

        // Existing cash movements were the shop's own money — attribute to default.
        $defaultId = DB::table('wallets')->where('is_default', true)->value('id');

        if ($defaultId !== null) {
            DB::table('transaction_events')
                ->whereIn('type', ['created', 'redeemed', 'extended', 'auctioned'])
                ->whereNull('wallet_id')
                ->update(['wallet_id' => $defaultId]);
        }
    }

    public function down(): void
    {
        Schema::table('transaction_events', function (Blueprint $table) {
            $table->dropColumn('wallet_id');
        });
    }
};
