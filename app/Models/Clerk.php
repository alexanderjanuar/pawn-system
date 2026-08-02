<?php

namespace App\Models;

use Database\Factories\ClerkFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A petugas on the shop roster. The login account belongs to the shop, so each
 * transaction records which roster clerk handled it (by name).
 *
 * @property int $id
 * @property int|null $store_id
 * @property string $name
 * @property bool $active
 */
#[Fillable(['store_id', 'name', 'active'])]
class Clerk extends Model
{
    /** @use HasFactory<ClerkFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
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
     * Limit the query to clerks that are currently active.
     *
     * @param  Builder<Clerk>  $query
     */
    #[Scope]
    protected function active(Builder $query): void
    {
        $query->where('active', true);
    }
}
