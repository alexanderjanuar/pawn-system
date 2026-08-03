<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One payment toward a piutang.
 *
 * @property int $id
 * @property int $piutang_id
 * @property int $amount
 * @property Carbon $paid_at
 * @property string|null $by
 * @property string|null $note
 */
#[Fillable(['piutang_id', 'amount', 'paid_at', 'by', 'note'])]
class PiutangPayment extends Model
{
    protected function casts(): array
    {
        return [
            'paid_at' => 'date',
            'amount' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Piutang, $this>
     */
    public function piutang(): BelongsTo
    {
        return $this->belongsTo(Piutang::class);
    }
}
