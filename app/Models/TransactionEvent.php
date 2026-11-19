<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $transaction_id
 * @property string $type
 * @property Carbon $event_date
 * @property string $title
 * @property string|null $note
 * @property string|null $by
 * @property int|null $amount
 * @property string|null $payment_method
 * @property int|null $wallet_id
 * @property array<int, array{wallet_id: int, amount: int}>|null $wallet_split
 * @property array{status: string, fee: int, fee_percent: int, denda: int}|null $previous_state
 */
#[Fillable([
    'transaction_id', 'type', 'event_date', 'title', 'note', 'by', 'amount', 'payment_method', 'wallet_id', 'wallet_split', 'previous_state',
])]
class TransactionEvent extends Model
{
    protected function casts(): array
    {
        return [
            'event_date' => 'date',
            'amount' => 'integer',
            'wallet_split' => 'array',
            'previous_state' => 'array',
        ];
    }

    /**
     * @return BelongsTo<Transaction, $this>
     */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }
}
