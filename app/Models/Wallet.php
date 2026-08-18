<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * A cash "pocket": the shop's own money, a lender's (Kak Gulam), etc. Every
 * cash movement is attributed to a wallet so each pocket's balance is tracked.
 *
 * @property int $id
 * @property string $name
 * @property bool $is_default
 * @property bool $is_active
 * @property int $sort
 */
#[Fillable(['name', 'is_default', 'is_active', 'sort'])]
class Wallet extends Model
{
    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'is_active' => 'boolean',
            'sort' => 'integer',
        ];
    }

    /**
     * Limit to wallets shown in pickers.
     *
     * @param  Builder<Wallet>  $query
     */
    #[Scope]
    protected function active(Builder $query): void
    {
        $query->where('is_active', true);
    }

    /** The id money defaults to when none is chosen (the shop's own pocket). */
    public static function defaultId(): ?int
    {
        return static::query()->where('is_default', true)->value('id')
            ?? static::query()->orderBy('sort')->orderBy('id')->value('id');
    }
}
