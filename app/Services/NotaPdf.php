<?php

namespace App\Services;

use App\Models\Transaction;
use App\Support\PhoneNumber;
use Barryvdh\DomPDF\Facade\Pdf as PdfFacade;
use Barryvdh\DomPDF\PDF;
use Carbon\CarbonInterface;

/**
 * Renders a transaction's nota (receipt) to a PDF, streamed on demand from the
 * short public link the customer receives over WhatsApp.
 */
class NotaPdf
{
    private const MONTHS = [
        1 => 'Jan', 2 => 'Feb', 3 => 'Mar', 4 => 'Apr', 5 => 'Mei', 6 => 'Jun',
        7 => 'Jul', 8 => 'Agu', 9 => 'Sep', 10 => 'Okt', 11 => 'Nov', 12 => 'Des',
    ];

    /** Build the nota PDF instance (caller decides to stream or download). */
    public function make(Transaction $transaction): PDF
    {
        $transaction->loadMissing('customer');

        return PdfFacade::loadView('pdf.nota', ['n' => $this->viewData($transaction)])
            ->setPaper('a4', 'portrait');
    }

    /** Suggested file name for the nota download. */
    public function filename(Transaction $transaction): string
    {
        $slug = preg_replace('/[^A-Za-z0-9._-]/', '', $transaction->code) ?: 'nota';

        return "Nota-{$slug}.pdf";
    }

    /**
     * Display-ready values for the Blade template.
     *
     * @return array<string, mixed>
     */
    private function viewData(Transaction $t): array
    {
        // An extended pawn's nota shows the start of its current period.
        $notaStart = $t->extensions > 0
            ? $t->due_date->copy()->subDays($t->tenor_days)
            : $t->start_date;

        $lockType = $t->device_lock_type ?? 'none';
        $lockValue = $t->device_lock_value;

        return [
            'code' => $t->code,
            'statusUrl' => route('cek-status', ['kode' => $t->code]),
            'customerName' => $t->customer->name,
            'customerPhone' => PhoneNumber::format($t->customer->phone) ?: '-',
            'customerAddress' => $t->customer->address ?: '-',
            'deviceOwner' => $t->device_owner ?: $t->customer->name,
            'deviceName' => $t->device_name,
            'kelengkapan' => $t->kelengkapan,
            'deviceType' => $t->device_type ?? 'hp',
            'platNomor' => $t->plat_nomor ?: '-',
            'noRangka' => $t->no_rangka ?: '-',
            'serial' => $t->device_serial ?: '-',
            'principal' => $this->rupiah((int) $t->principal),
            'fee' => $this->rupiah((int) $t->fee),
            'notaStartDate' => $this->idDate($notaStart),
            'dueDate' => $this->idDate($t->due_date),
            'hasLock' => $lockType !== 'none' && filled($lockValue),
            'lockLabel' => 'Kunci Barang'.match ($lockType) {
                'pin' => ' · PIN',
                'password' => ' · Kata Sandi',
                'pattern' => ' · Pola',
                default => '',
            },
            'lockType' => $lockType,
            'lockValue' => $lockValue,
            'lockGrid' => $lockType === 'pattern' ? $this->patternGrid($lockValue) : [],
            'lockSequence' => $lockType === 'pattern'
                ? implode(' → ', $this->patternSequence($lockValue))
                : '',
            'notes' => $t->notes,
            'clerk' => $t->clerk,
        ];
    }

    /**
     * Map of dot number (1-9) to its 1-based tap order, for the pattern grid.
     *
     * @return array<int, int|null>
     */
    private function patternGrid(?string $value): array
    {
        $order = [];

        foreach ($this->patternSequence($value) as $i => $dot) {
            $order[$dot] = $i + 1;
        }

        return array_map(fn (int $n) => $order[$n] ?? null, range(1, 9));
    }

    /**
     * Parse a "1-2-3" pattern into a validated list of dot numbers (1-9).
     *
     * @return array<int, int>
     */
    private function patternSequence(?string $value): array
    {
        return collect(explode('-', (string) $value))
            ->map(fn ($s) => (int) trim($s))
            ->filter(fn (int $n) => $n >= 1 && $n <= 9)
            ->values()
            ->all();
    }

    private function idDate(CarbonInterface $date): string
    {
        return $date->day.' '.self::MONTHS[$date->month].' '.$date->year;
    }

    private function rupiah(int $amount): string
    {
        return 'Rp '.number_format($amount, 0, ',', '.');
    }
}
