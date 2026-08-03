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
        Schema::create('piutangs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->nullable()->constrained()->nullOnDelete();
            $table->string('code');
            $table->string('debtor_name');       // peminjam (karyawan / nama orang)
            $table->string('device_name');       // nama HP yang diambil
            $table->unsignedBigInteger('price'); // total harga / utang
            $table->date('date');                // tanggal ambil
            $table->string('status')->default('berjalan'); // berjalan | lunas
            $table->string('clerk')->nullable(); // petugas yang mencatat
            $table->string('notes')->nullable();
            $table->timestamps();

            $table->unique(['store_id', 'code']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('piutangs');
    }
};
