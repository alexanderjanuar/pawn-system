<?php

namespace App\Console\Commands;

use App\Models\Rak;
use App\Models\Transaction;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Collection;

#[Signature('rak:audit')]
#[Description('Cocokkan isi rak di sistem dengan barang yang masih dipegang toko. Hanya membaca data, tidak mengubah apa pun.')]
class AuditRak extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        /** @var Collection<int, Transaction> $held */
        $held = Transaction::query()
            ->held()
            ->with(['customer', 'rak', 'store'])
            ->orderBy('store_id')
            ->orderByDesc('start_date')
            ->get();

        $this->newLine();
        $this->info('AUDIT RAK · '.now()->format('d/m/Y H:i'));
        $this->line('Barang yang masih dipegang toko: '.$held->count());
        $this->newLine();

        $issues = 0;
        $issues += $this->reportUnplaced($held);
        $issues += $this->reportWrongStore($held);
        $issues += $this->reportOverCapacity($held);
        $issues += $this->reportStaleRak();

        $this->reportPerRak($held);

        if ($issues === 0) {
            $this->info('Tidak ada selisih. Isi rak di sistem sudah cocok dengan barang yang dipegang.');
        } else {
            $this->warn("Ditemukan {$issues} baris yang perlu dicek.");
        }

        return self::SUCCESS;
    }

    /**
     * Phones still in the shop that sit on no rack at all. These are invisible
     * on the Rak page, so the shelf holds more than the system shows.
     *
     * @param  Collection<int, Transaction>  $held
     */
    private function reportUnplaced(Collection $held): int
    {
        $rows = $held->whereNull('rak_id');

        $this->line('1. BARANG DIPEGANG TAPI BELUM PUNYA RAK: '.$rows->count());

        if ($rows->isEmpty()) {
            $this->newLine();

            return 0;
        }

        $this->table(
            ['Kode', 'Pelanggan', 'Barang', 'Status', 'Masuk', 'Toko'],
            $rows->map(fn (Transaction $t): array => [
                $t->code,
                $t->customer->name,
                $t->device_name,
                $t->status,
                $t->start_date->format('d/m/Y'),
                $t->store?->name ?? '-',
            ])->all(),
        );

        return $rows->count();
    }

    /**
     * A phone parked on a rack that belongs to another store.
     *
     * @param  Collection<int, Transaction>  $held
     */
    private function reportWrongStore(Collection $held): int
    {
        $rows = $held->filter(
            fn (Transaction $t): bool => $t->rak !== null && $t->rak->store_id !== $t->store_id,
        );

        $this->line('2. RAK DARI TOKO YANG BERBEDA: '.$rows->count());

        if ($rows->isEmpty()) {
            $this->newLine();

            return 0;
        }

        $this->table(
            ['Kode', 'Barang', 'Toko transaksi', 'Rak', 'Toko rak'],
            $rows->map(fn (Transaction $t): array => [
                $t->code,
                $t->device_name,
                $t->store?->name ?? '-',
                $t->rak?->name ?? '-',
                $t->rak?->store?->name ?? '-',
            ])->all(),
        );

        return $rows->count();
    }

    /**
     * Racks holding more than their stated capacity.
     *
     * @param  Collection<int, Transaction>  $held
     */
    private function reportOverCapacity(Collection $held): int
    {
        $counts = $held->whereNotNull('rak_id')->countBy('rak_id');

        $rows = Rak::sortNaturally(Rak::with('store')->get())
            ->filter(fn (Rak $rak): bool => $rak->capacity !== null
                && ($counts[$rak->id] ?? 0) > $rak->capacity);

        $this->line('3. RAK MELEBIHI KAPASITAS: '.$rows->count());

        if ($rows->isEmpty()) {
            $this->newLine();

            return 0;
        }

        $this->table(
            ['Rak', 'Isi', 'Kapasitas', 'Toko'],
            $rows->map(fn (Rak $rak): array => [
                $rak->name,
                (string) ($counts[$rak->id] ?? 0),
                (string) $rak->capacity,
                $rak->store?->name ?? '-',
            ])->all(),
        );

        return $rows->count();
    }

    /**
     * Left-over rack links on phones that already left the shop. Harmless for
     * the Rak page (it only counts held items) but confusing on the detail page.
     */
    private function reportStaleRak(): int
    {
        $count = Transaction::query()
            ->whereNotNull('rak_id')
            ->where(fn ($q) => $q->where('status', 'DIAMBIL')->orWhereNotNull('sold_at'))
            ->count();

        $this->line('4. SISA DATA RAK PADA BARANG YANG SUDAH KELUAR: '.$count);
        $this->line('   (tidak memengaruhi hitungan rak, hanya keterangan lama di halaman detail)');
        $this->newLine();

        return 0;
    }

    /**
     * What the system believes each rack holds, for a physical stock-take.
     *
     * @param  Collection<int, Transaction>  $held
     */
    private function reportPerRak(Collection $held): void
    {
        $counts = $held->whereNotNull('rak_id')->countBy('rak_id');
        $racks = Rak::sortNaturally(Rak::with('store')->get());

        $this->line('ISI RAK MENURUT SISTEM (untuk dicocokkan dengan fisik):');
        $this->table(
            ['Rak', 'Isi', 'Kapasitas', 'Aktif', 'Toko'],
            $racks->map(fn (Rak $rak): array => [
                $rak->name,
                (string) ($counts[$rak->id] ?? 0),
                $rak->capacity !== null ? (string) $rak->capacity : '-',
                $rak->active ? 'ya' : 'tidak',
                $rak->store?->name ?? '-',
            ])->all(),
        );

        $unplaced = $held->whereNull('rak_id')->count();
        $placed = $held->count() - $unplaced;

        $this->line("Total dipegang: {$held->count()} · sudah di rak: {$placed} · belum di rak: {$unplaced}");
        $this->newLine();
    }
}
