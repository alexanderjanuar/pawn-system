<?php

use App\Support\PhoneNumber;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Bring numbers typed in mixed styles ("0838-3620-2747", "+62 812…") into
     * the one canonical shape new writes already use, so the same person is no
     * longer stored two different ways.
     */
    public function up(): void
    {
        $this->normalize('customers', 'phone');
        $this->normalize('piutangs', 'debtor_phone');
        $this->normalize('stores', 'phone');
    }

    /**
     * Separators cannot be put back, and the digits are unchanged, so there is
     * nothing meaningful to reverse.
     */
    public function down(): void {}

    private function normalize(string $table, string $column): void
    {
        DB::table($table)
            ->select('id', $column)
            ->whereNotNull($column)
            ->orderBy('id')
            ->chunk(200, function ($rows) use ($table, $column): void {
                foreach ($rows as $row) {
                    $current = (string) $row->{$column};
                    $normalized = PhoneNumber::normalize($current);

                    if ($normalized !== null && $normalized !== $current) {
                        DB::table($table)
                            ->where('id', $row->id)
                            ->update([$column => $normalized]);
                    }
                }
            });
    }
};
