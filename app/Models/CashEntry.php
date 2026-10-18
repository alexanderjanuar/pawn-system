<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A manual cash movement (not tied to a gadai) recorded on the daily cash page.
 * A cash-out carrying a category is a shop operating cost (biaya operasional).
 *
 * @property int $id
 * @property int|null $store_id
 * @property Carbon $entry_date
 * @property string $direction
 * @property string|null $category
 * @property int $amount
 * @property string $description
 * @property string|null $note
 * @property string|null $method
 * @property string|null $by
 * @property int|null $wallet_id
 */
#[Fillable(['store_id', 'entry_date', 'direction', 'category', 'amount', 'description', 'note', 'method', 'by', 'wallet_id'])]
class CashEntry extends Model
{
    /**
     * Kinds of operating cost, in the order the form offers them.
     *
     * @var array<string, string>
     */
    public const EXPENSE_CATEGORIES = [
        'sewa' => 'Sewa Tempat',
        'listrik' => 'Listrik, Air & Internet',
        'gaji' => 'Gaji & Upah',
        'atk' => 'ATK & Perlengkapan',
        'transport' => 'Transportasi & Bensin',
        'konsumsi' => 'Konsumsi',
        'perawatan' => 'Perawatan & Perbaikan',
        'lainnya' => 'Lainnya',
    ];

    protected function casts(): array
    {
        return [
            'entry_date' => 'date',
            'amount' => 'integer',
        ];
    }

    /**
     * Operating costs only: money out that was filed under a category.
     *
     * @param  Builder<CashEntry>  $query
     */
    #[Scope]
    protected function expense(Builder $query): void
    {
        $query->where('direction', 'out')->whereNotNull('category');
    }

    public function isExpense(): bool
    {
        return $this->direction === 'out' && $this->category !== null;
    }

    public function categoryLabel(): string
    {
        return self::EXPENSE_CATEGORIES[$this->category] ?? 'Lainnya';
    }

    /**
     * @return BelongsTo<Store, $this>
     */
    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    /**
     * @return BelongsTo<Wallet, $this>
     */
    public function wallet(): BelongsTo
    {
        return $this->belongsTo(Wallet::class);
    }
}
