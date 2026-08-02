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
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique(); // nomor nota, e.g. GCG-20260729-0001
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->string('device_owner');
            $table->string('device_name');
            $table->string('device_ram')->nullable();
            $table->string('device_storage')->nullable();
            $table->string('device_serial')->nullable();
            $table->string('kelengkapan');
            $table->unsignedBigInteger('principal');
            $table->unsignedInteger('tenor_days');
            $table->unsignedInteger('fee_percent');
            $table->unsignedBigInteger('fee');
            $table->date('start_date');
            $table->date('due_date');
            $table->string('status')->default('AKTIF')->index();
            $table->string('clerk');
            $table->text('notes')->nullable();
            $table->unsignedInteger('extensions')->default(0);
            $table->json('photos')->nullable();
            $table->string('ktp_path')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
