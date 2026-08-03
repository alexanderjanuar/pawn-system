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
        Schema::create('piutang_termins', function (Blueprint $table) {
            $table->id();
            $table->foreignId('piutang_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('seq');
            $table->unsignedBigInteger('amount');
            $table->date('due_date');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('piutang_termins');
    }
};
