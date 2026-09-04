<?php

namespace App\Models;

use App\Support\PhoneNumber;
use Database\Factories\CustomerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string $phone
 * @property string|null $address
 * @property string|null $id_number
 * @property string|null $notes
 * @property Carbon $join_date
 * @property Carbon|null $blacklisted_at
 * @property string|null $blacklist_reason
 */
#[Fillable([
    'code', 'name', 'phone', 'address', 'id_number', 'notes', 'join_date',
    'blacklisted_at', 'blacklist_reason',
])]
class Customer extends Model
{
    /** @use HasFactory<CustomerFactory> */
    use HasFactory;

    public function getRouteKeyName(): string
    {
        return 'code';
    }

    /**
     * Store the number in one canonical shape, whatever the clerk typed.
     *
     * @return Attribute<string|null, string|null>
     */
    protected function phone(): Attribute
    {
        // A blank value keeps its shape ('' stays '', null stays null) so the
        // column's own nullability contract is untouched.
        return Attribute::set(fn (?string $value): ?string => blank($value)
            ? $value
            : PhoneNumber::normalize($value));
    }

    protected function casts(): array
    {
        return [
            'join_date' => 'date',
            'blacklisted_at' => 'datetime',
        ];
    }

    public function isBlacklisted(): bool
    {
        return $this->blacklisted_at !== null;
    }

    /**
     * @return HasMany<Transaction, $this>
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    /**
     * Generate the next sequential customer code (PLG-001).
     */
    public static function nextCode(): string
    {
        $last = static::query()->max('id') ?? 0;

        return 'PLG-'.str_pad((string) ($last + 1), 3, '0', STR_PAD_LEFT);
    }
}
