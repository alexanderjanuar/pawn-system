<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A manual cash movement (not tied to a gadai) recorded on the daily cash page.
 *
 * @property int $id
 * @property int|null $store_id
 * @property Carbon $entry_date
 * @property string $direction
 * @property int $amount
 * @property string $description
 * @property string|null $method
 * @property string|null $by
 */
#[Fillable(['store_id', 'entry_date', 'direction', 'amount', 'description', 'method', 'by'])]
class CashEntry extends Model
{
    protected function casts(): array
    {
        return [
            'entry_date' => 'date',
            'amount' => 'integer',
        ];
    }
}
