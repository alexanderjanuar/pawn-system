<?php

namespace App\Models;

use App\Support\ActiveStore;
use App\Support\PhoneNumber;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A phone taken on credit (piutang / receivable): the debtor owes the shop and
 * pays it off over time. Separate from gadai (a collateral loan).
 *
 * @property int $id
 * @property int|null $store_id
 * @property string $code
 * @property string $debtor_name
 * @property string|null $debtor_phone
 * @property string $device_name
 * @property int $price
 * @property int $down_payment
 * @property Carbon $date
 * @property string $status
 * @property string|null $clerk
 * @property string|null $notes
 */
#[Fillable([
    'store_id', 'code', 'debtor_name', 'debtor_phone', 'device_name', 'price', 'down_payment',
    'date', 'status', 'clerk', 'notes',
])]
class Piutang extends Model
{
    /**
     * Store the debtor number in one canonical shape, whatever was typed.
     *
     * @return Attribute<string|null, string|null>
     */
    protected function debtorPhone(): Attribute
    {
        // A blank value keeps its shape ('' stays '', null stays null) so the
        // column's own nullability contract is untouched.
        return Attribute::set(fn (?string $value): ?string => blank($value)
            ? $value
            : PhoneNumber::normalize($value));
    }

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'price' => 'integer',
            'down_payment' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Store, $this>
     */
    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    /**
     * @return HasMany<PiutangPayment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(PiutangPayment::class);
    }

    /**
     * @return HasMany<PiutangTermin, $this>
     */
    public function termins(): HasMany
    {
        return $this->hasMany(PiutangTermin::class)->orderBy('seq');
    }

    /**
     * Replace the schedule with $count equal termins, due monthly from $start.
     * The last termin absorbs any rounding remainder so the sum equals the
     * financed amount (price minus DP).
     */
    public function generateTermins(int $count, CarbonInterface $start): void
    {
        $this->termins()->delete();

        if ($count < 2) {
            return;
        }

        $financed = $this->financed();
        $base = intdiv($financed, $count);
        $due = Carbon::parse($start);

        for ($i = 1; $i <= $count; $i++) {
            $amount = $i === $count ? $financed - $base * ($count - 1) : $base;

            $this->termins()->create([
                'seq' => $i,
                'amount' => $amount,
                'due_date' => $due->copy()->addMonthsNoOverflow($i),
            ]);
        }
    }

    /**
     * Termin rows with payment applied in order and a computed status.
     *
     * @return array<int, array{seq: int, amount: int, dueDate: string, paid: int, status: string}>
     */
    public function terminSchedule(): array
    {
        $remaining = $this->paid();
        $today = Carbon::today();

        return $this->termins->map(function (PiutangTermin $t) use (&$remaining, $today): array {
            $applied = (int) min($t->amount, max(0, $remaining));
            $remaining -= $applied;

            $status = $applied >= $t->amount
                ? 'lunas'
                : ($t->due_date->lt($today) ? 'telat' : 'belum');

            return [
                'seq' => $t->seq,
                'amount' => $t->amount,
                'dueDate' => $t->due_date->format('Y-m-d'),
                'paid' => $applied,
                'status' => $status,
            ];
        })->all();
    }

    /** Amount to be paid in installments: total price minus the down payment. */
    public function financed(): int
    {
        return max(0, $this->price - $this->down_payment);
    }

    /** Total already paid in installments (from loaded payments when available). */
    public function paid(): int
    {
        return (int) ($this->relationLoaded('payments')
            ? $this->payments->sum('amount')
            : $this->payments()->sum('amount'));
    }

    /** Remaining installment balance still owed (excludes the DP). */
    public function remaining(): int
    {
        return max(0, $this->financed() - $this->paid());
    }

    public function isLunas(): bool
    {
        return $this->remaining() <= 0;
    }

    /**
     * Recompute status from payments and persist it.
     */
    public function syncStatus(): void
    {
        $status = $this->isLunas() ? 'lunas' : 'berjalan';

        if ($status !== $this->status) {
            $this->update(['status' => $status]);
        }
    }

    /**
     * Limit the query to the active store (no filter when "all"/unset).
     *
     * @param  Builder<Piutang>  $query
     */
    #[Scope]
    protected function forActiveStore(Builder $query): void
    {
        $storeId = app(ActiveStore::class)->id();

        if ($storeId !== null) {
            $query->where('store_id', $storeId);
        }
    }

    /**
     * Next piutang code for a store, e.g. PT-20260803-0001 (daily sequence).
     */
    public static function nextCode(?Store $store, CarbonInterface $date): string
    {
        $prefix = 'PT-'.$date->format('Ymd').'-';

        $lastCode = static::query()
            ->when($store, fn ($q) => $q->where('store_id', $store->id))
            ->where('code', 'like', $prefix.'%')
            ->orderByDesc('code')
            ->value('code');

        $seq = $lastCode !== null
            ? (int) substr($lastCode, strlen($prefix)) + 1
            : 1;

        return $prefix.str_pad((string) $seq, 4, '0', STR_PAD_LEFT);
    }
}
