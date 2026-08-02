<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A shop/branch. Transactions, petugas (clerks) and staff accounts belong to a
 * store; the customer database is shared across all stores.
 *
 * @property int $id
 * @property string $code
 * @property string|null $nota_prefix
 * @property string $name
 * @property string|null $address
 * @property string|null $phone
 * @property bool $active
 */
#[Fillable(['code', 'nota_prefix', 'name', 'address', 'phone', 'active'])]
class Store extends Model
{
    protected function casts(): array
    {
        return [
            'active' => 'boolean',
        ];
    }

    /**
     * Limit the query to stores that are currently active.
     *
     * @param  Builder<Store>  $query
     */
    #[Scope]
    protected function active(Builder $query): void
    {
        $query->where('active', true);
    }

    /**
     * @return HasMany<Transaction, $this>
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    /**
     * @return HasMany<Clerk, $this>
     */
    public function clerks(): HasMany
    {
        return $this->hasMany(Clerk::class);
    }

    /**
     * @return HasMany<User, $this>
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * Prefix used for this store's nota numbers, e.g. GCG-YYYYMMDD-0001.
     */
    public function notaPrefix(): string
    {
        return $this->nota_prefix ?: 'GCG';
    }

    /**
     * Generate the next sequential store code (TK-001).
     */
    public static function nextCode(): string
    {
        $last = static::query()->max('id') ?? 0;

        return 'TK-'.str_pad((string) ($last + 1), 3, '0', STR_PAD_LEFT);
    }
}
