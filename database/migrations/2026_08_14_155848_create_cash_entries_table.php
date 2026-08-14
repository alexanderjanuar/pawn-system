<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cash_entries', function (Blueprint $table) {
            $table->id();
            // Manual cash movements not tied to a gadai (e.g. buying supplies,
            // paying the electric bill, topping up the drawer). Counts toward
            // the daily cash reconciliation. Per store (null = single shop).
            $table->foreignId('store_id')->nullable();
            $table->date('entry_date');
            $table->string('direction'); // in | out
            $table->unsignedBigInteger('amount');
            $table->string('description');
            $table->string('method')->nullable(); // cash | transfer
            $table->string('by')->nullable();
            $table->timestamps();

            $table->index(['store_id', 'entry_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_entries');
    }
};
