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
        Schema::create('cash_anchors', function (Blueprint $table) {
            $table->id();
            // The physical cash balance at the start of anchor_date; the running
            // balance is computed forward from here. Set once at go-live and
            // corrected during reconciliation. Per store (null = single shop).
            $table->foreignId('store_id')->nullable();
            $table->date('anchor_date');
            $table->unsignedBigInteger('amount');
            $table->string('note')->nullable();
            $table->string('set_by')->nullable();
            $table->timestamps();

            $table->index(['store_id', 'anchor_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cash_anchors');
    }
};
