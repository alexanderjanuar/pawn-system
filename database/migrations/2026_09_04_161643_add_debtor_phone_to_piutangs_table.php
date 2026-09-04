<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A debtor's WhatsApp number, so instalment reminders can be sent straight
     * from the piutang list without opening each record.
     */
    public function up(): void
    {
        Schema::table('piutangs', function (Blueprint $table) {
            $table->string('debtor_phone')->nullable()->after('debtor_name');
        });
    }

    public function down(): void
    {
        Schema::table('piutangs', function (Blueprint $table) {
            $table->dropColumn('debtor_phone');
        });
    }
};
