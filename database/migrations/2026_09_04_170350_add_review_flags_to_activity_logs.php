<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Sensitive actions (cancellations, deletions, oversized discounts) are
     * marked so the owner can work through them from the dashboard instead of
     * hunting for them in a log of thousands of rows.
     */
    public function up(): void
    {
        Schema::table('activity_logs', function (Blueprint $table) {
            $table->boolean('flagged')->default(false)->after('changes');
            $table->timestamp('reviewed_at')->nullable()->after('flagged');
            $table->string('reviewed_by')->nullable()->after('reviewed_at');
            $table->index(['flagged', 'reviewed_at']);
        });
    }

    public function down(): void
    {
        Schema::table('activity_logs', function (Blueprint $table) {
            $table->dropIndex(['flagged', 'reviewed_at']);
            $table->dropColumn(['flagged', 'reviewed_at', 'reviewed_by']);
        });
    }
};
