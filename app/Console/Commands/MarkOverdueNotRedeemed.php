<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Models\Transaction;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('gadai:mark-not-redeemed {--days=7 : Jumlah hari setelah jatuh tempo sebelum ditandai tidak diambil} {--dry-run : Tampilkan calon transaksi tanpa mengubah data}')]
#[Description('Tandai gadai yang lewat jatuh tempo sekian hari (default 7) sebagai "Tidak Diambil".')]
class MarkOverdueNotRedeemed extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $days = max(0, (int) $this->option('days'));
        $dryRun = (bool) $this->option('dry-run');
        $cutoff = now()->subDays($days)->toDateString();

        // Only approved, still-live loans (AKTIF/PERPANJANG) whose due date is
        // at least $days days in the past. Pending/rejected loans never had
        // funds disbursed, so they are left alone. All stores are processed.
        $transactions = Transaction::query()
            ->whereIn('status', ['AKTIF', 'PERPANJANG'])
            ->where('approval_status', 'approved')
            ->whereDate('due_date', '<=', $cutoff)
            ->get();

        if ($transactions->isEmpty()) {
            $this->info("Tidak ada transaksi yang lewat jatuh tempo {$days} hari.");

            return self::SUCCESS;
        }

        foreach ($transactions as $transaction) {
            $this->line("{$transaction->code} · {$transaction->customer->name} · jatuh tempo {$transaction->due_date->format('Y-m-d')}");

            if ($dryRun) {
                continue;
            }

            $transaction->update(['status' => 'TIDAK_DIAMBIL']);

            $transaction->events()->create([
                'type' => 'flagged',
                'event_date' => now(),
                'title' => 'Ditandai tidak diambil (otomatis)',
                'by' => 'Sistem',
            ]);

            ActivityLog::record(
                'updated',
                'transaction',
                $transaction->code,
                $transaction->customer->name,
                "Menandai barang tidak diambil (otomatis, lewat jatuh tempo {$days} hari)",
            );
        }

        $count = $transactions->count();

        $this->info($dryRun
            ? "{$count} transaksi akan ditandai tidak diambil (dry-run, tidak ada perubahan)."
            : "{$count} transaksi ditandai tidak diambil.");

        return self::SUCCESS;
    }
}
