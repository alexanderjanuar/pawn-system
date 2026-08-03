<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One scheduled installment (termin) of a piutang.
 *
 * @property int $id
 * @property int $piutang_id
 * @property int $seq
 * @property int $amount
 * @property Carbon $due_date
 */
#[Fillable(['piutang_id', 'seq', 'amount', 'due_date'])]
class PiutangTermin extends Model
{
    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'amount' => 'integer',
            'seq' => 'integer',
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
