<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Models\Transaction;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

#[Signature('gadai:repair-due-dates {--dry-run : Tampilkan calon perbaikan tanpa mengubah data}')]
#[Description('Perbaiki jatuh tempo gadai yang ter-reset akibat edit setelah diperpanjang.')]
class RepairExtendedDueDates extends Command
{
    /**
     * Older edits recomputed due_date from start_date + tenor, reverting
     * extended loans to their pre-extension due date. This restores each such
     * loan to the furthest extension target recorded in the activity log.
     */
    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $fixed = 0;

        Transaction::query()
            ->where('extensions', '>', 0)
            ->with('customer')
            ->chunkById(200, function ($transactions) use (&$fixed, $dryRun) {
                foreach ($transactions as $transaction) {
                    $target = $this->intendedDueDate($transaction->code);

                    // Only repair loans whose due date is earlier than the
                    // known extension target (i.e. reverted); never shorten.
                    if ($target === null || $transaction->due_date->greaterThanOrEqualTo($target)) {
                        continue;
                    }

                    $this->line(sprintf(
                        '%s · %s: %s -> %s',
                        $transaction->code,
                        $transaction->customer?->name ?? '—',
                        $transaction->due_date->format('Y-m-d'),
                        $target->format('Y-m-d'),
                    ));
                    $fixed++;

                    if (! $dryRun) {
                        $transaction->update(['due_date' => $target]);
                    }
                }
            });

        $this->info($dryRun
            ? "{$fixed} transaksi akan diperbaiki (dry-run, tidak ada perubahan)."
            : "{$fixed} transaksi diperbaiki.");

        return self::SUCCESS;
    }

    /**
     * The furthest "Memperpanjang s/d YYYY-MM-DD" date logged for a loan.
     */
    private function intendedDueDate(string $code): ?Carbon
    {
        return ActivityLog::query()
            ->where('subject_type', 'transaction')
            ->where('subject_code', $code)
            ->where('description', 'like', 'Memperpanjang s/d %')
            ->pluck('description')
            ->map(function (string $description): ?Carbon {
                $iso = trim(str_replace('Memperpanjang s/d', '', $description));

                try {
                    return Carbon::parse($iso)->startOfDay();
                } catch (\Throwable) {
                    return null;
                }
            })
            ->filter()
            ->sortByDesc(fn (Carbon $date) => $date->getTimestamp())
            ->first();
    }
}
