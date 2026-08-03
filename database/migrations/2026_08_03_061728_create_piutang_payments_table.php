<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('piutang_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('piutang_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('amount');
            $table->date('paid_at');
            $table->string('by')->nullable();   // petugas yang menerima
            $table->string('note')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('piutang_payments');
    }
};
