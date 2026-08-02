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
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            // Nullable so the log survives even if the actor's account is removed.
            $table->foreignId('user_id')->nullable()->nullOnDelete();
            $table->string('actor'); // snapshot of the actor name at the time
            $table->string('action')->index(); // created | updated | deleted
            $table->string('subject_type')->index(); // transaction | customer
            $table->string('subject_code')->nullable()->index(); // GCG-… / PLG-…
            $table->string('subject_label')->nullable(); // e.g. customer or device
            $table->string('description');
            // Field-level diff for updates: [{field, from, to}, …]
            $table->json('changes')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
