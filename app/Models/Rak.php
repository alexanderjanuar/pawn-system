<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

/**
 * A physical rack/shelf where a pawned phone is stored, per store.
 *
 * @property int $id
 * @property int|null $store_id
 * @property string $name
 * @property int|null $capacity
 * @property bool $active
 */
#[Fillable(['store_id', 'name', 'capacity', 'active'])]
class Rak extends Model
{
    protected function casts(): array
    {
        return [
            'capacity' => 'integer',
            'active' => 'boolean',
        ];
    }

    /**
     * Limit the query to racks that are currently active.
     *
     * @param  Builder<Rak>  $query
     */
    #[Scope]
    protected function active(Builder $query): void
    {
        $query->where('active', true);
    }

    /**
     * Order racks the way people read them: Rak 1, Rak 2, ... Rak 10, Rak 11.
     * SQL sorts "Rak 10" before "Rak 2" because the name is text, so the
     * natural ordering is applied in PHP after the query.
     *
     * @param  Collection<int, Rak>  $racks
     * @return Collection<int, Rak>
     */
    public static function sortNaturally(Collection $racks): Collection
    {
        return $racks
            ->sortBy(fn (Rak $rak): string => $rak->name, SORT_NATURAL | SORT_FLAG_CASE)
            ->values();
    }

    /**
     * @return BelongsTo<Store, $this>
     */
    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    /**
     * @return HasMany<Transaction, $this>
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }
}
