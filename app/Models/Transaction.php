<?php

namespace App\Models;

use App\Support\ActiveStore;
use Carbon\CarbonInterface;
use Database\Factories\TransactionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int|null $store_id
 * @property int|null $rak_id
 * @property string $code
 * @property int $customer_id
 * @property string $device_owner
 * @property string $device_type
 * @property string $device_name
 * @property string|null $device_ram
 * @property string|null $device_storage
 * @property string|null $device_serial
 * @property string|null $imei_1
 * @property string|null $imei_2
 * @property string $device_lock_type
 * @property string|null $device_lock_value
 * @property string|null $plat_nomor
 * @property string|null $no_rangka
 * @property string|null $no_mesin
 * @property string|null $warna
 * @property string|null $tahun
 * @property string $kelengkapan
 * @property int $principal
 * @property int $tenor_days
 * @property int $fee_percent
 * @property int $fee
 * @property int|null $sale_value
 * @property Carbon|null $sold_at
 * @property Carbon $start_date
 * @property Carbon $due_date
 * @property string $status
 * @property string $clerk
 * @property string|null $notes
 * @property int $extensions
 * @property array<int, array{path: string, label: string|null}>|null $photos
 * @property string|null $ktp_path
 */
#[Fillable([
    'store_id', 'rak_id',
    'code', 'customer_id', 'device_owner', 'device_type', 'device_name', 'device_ram',
    'device_storage', 'device_serial', 'imei_1', 'imei_2', 'device_lock_type', 'device_lock_value',
    'plat_nomor', 'no_rangka', 'no_mesin', 'warna', 'tahun',
    'kelengkapan', 'principal', 'tenor_days',
    'fee_percent', 'fee', 'start_date', 'due_date', 'status', 'clerk', 'notes',
    'extensions', 'photos', 'ktp_path',
    'approval_status', 'approved_by', 'approved_at',
    'sale_value', 'sold_at',
])]
class Transaction extends Model
{
    /** @use HasFactory<TransactionFactory> */
    use HasFactory;

    /** Loans strictly above this amount need Owner approval before disbursal. */
    public const APPROVAL_THRESHOLD = 5_000_000;

    public function getRouteKeyName(): string
    {
        return 'code';
    }

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'due_date' => 'date',
            'principal' => 'integer',
            'fee' => 'integer',
            'fee_percent' => 'integer',
            'tenor_days' => 'integer',
            'extensions' => 'integer',
            'photos' => 'array',
            'approved_at' => 'datetime',
            'sale_value' => 'integer',
            'sold_at' => 'datetime',
        ];
    }

    public function isPendingApproval(): bool
    {
        return $this->approval_status === 'pending';
    }

    /**
     * @return BelongsTo<Customer, $this>
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /**
     * @return BelongsTo<Store, $this>
     */
    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    /**
     * @return BelongsTo<Rak, $this>
     */
    public function rak(): BelongsTo
    {
        return $this->belongsTo(Rak::class);
    }

    /**
     * Items still physically held in the shop (on a rack): not yet redeemed and
     * not yet sold at auction.
     *
     * @param  Builder<Transaction>  $query
     */
    #[Scope]
    protected function held(Builder $query): void
    {
        $query->where('status', '!=', 'DIAMBIL')->whereNull('sold_at');
    }

    /**
     * Limit the query to the active store. No filter when the active store is
     * "all" (management overview) or unset (single-shop / no stores yet).
     *
     * @param  Builder<Transaction>  $query
     */
    #[Scope]
    protected function forActiveStore(Builder $query): void
    {
        $storeId = app(ActiveStore::class)->id();

        if ($storeId !== null) {
            $query->where('store_id', $storeId);
        }
    }

    /**
     * @return HasMany<TransactionEvent, $this>
     */
    public function events(): HasMany
    {
        return $this->hasMany(TransactionEvent::class);
    }

    /**
     * Generate the next transaction (nota) number, e.g. GCG-20260729-0001.
     * The 4-digit sequence restarts at 0001 each day, per store. Each store has
     * a distinct nota prefix so codes never collide across branches.
     */
    public static function nextCode(?Store $store, CarbonInterface $date): string
    {
        $prefix = ($store?->notaPrefix() ?? 'GCG').'-'.$date->format('Ymd').'-';

        $lastCode = static::query()
            ->where('code', 'like', $prefix.'%')
            ->when($store !== null, fn ($query) => $query->where('store_id', $store->id))
            ->orderByDesc('code')
            ->value('code');

        $seq = $lastCode !== null
            ? (int) substr($lastCode, strlen($prefix)) + 1
            : 1;

        return $prefix.str_pad((string) $seq, 4, '0', STR_PAD_LEFT);
    }
}
