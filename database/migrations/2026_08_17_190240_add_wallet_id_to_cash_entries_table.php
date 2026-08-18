<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cash_entries', function (Blueprint $table) {
            $table->foreignId('wallet_id')->nullable()->after('method')->index();
        });

        $defaultId = DB::table('wallets')->where('is_default', true)->value('id');

        if ($defaultId !== null) {
            DB::table('cash_entries')->whereNull('wallet_id')->update(['wallet_id' => $defaultId]);
        }
    }

    public function down(): void
    {
        Schema::table('cash_entries', function (Blueprint $table) {
            $table->dropColumn('wallet_id');
        });
    }
};
