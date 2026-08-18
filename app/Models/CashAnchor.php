<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A physical cash-balance checkpoint. The running balance is computed forward
 * from the most recent anchor plus the net cash movements since its date.
 *
 * @property int $id
 * @property int|null $store_id
 * @property int|null $wallet_id
 * @property Carbon $anchor_date
 * @property int $amount
 * @property string|null $note
 * @property string|null $set_by
 */
#[Fillable(['store_id', 'wallet_id', 'anchor_date', 'amount', 'note', 'set_by'])]
class CashAnchor extends Model
{
    protected function casts(): array
    {
        return [
            'anchor_date' => 'date',
            'amount' => 'integer',
        ];
    }
}
