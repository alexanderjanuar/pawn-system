<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Per-store nota prefix so each branch has its own daily sequence
        // without code collisions (transactions.code is globally unique).
        Schema::table('stores', function (Blueprint $table) {
            $table->string('nota_prefix')->nullable()->after('code');
        });

        // Scope the audit log per store.
        Schema::table('activity_logs', function (Blueprint $table) {
            $table->foreignId('store_id')->nullable()->after('id')->constrained()->nullOnDelete();
        });

        // Petugas names are unique per store, not globally, so branches can
        // have staff with the same name.
        Schema::table('clerks', function (Blueprint $table) {
            $table->dropUnique(['name']);
            $table->unique(['store_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::table('clerks', function (Blueprint $table) {
            $table->dropUnique(['store_id', 'name']);
            $table->unique(['name']);
        });

        Schema::table('activity_logs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('store_id');
        });

        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumn('nota_prefix');
        });
    }
};
