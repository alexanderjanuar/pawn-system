<?php

namespace App\Models;

use App\Support\ActiveStore;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int|null $store_id
 * @property int|null $user_id
 * @property string $actor
 * @property string $action
 * @property string $subject_type
 * @property string|null $subject_code
 * @property string|null $subject_label
 * @property string $description
 * @property array<int, array{field: string, from: string|null, to: string|null}>|null $changes
 * @property bool $flagged
 * @property Carbon|null $reviewed_at
 * @property string|null $reviewed_by
 * @property Carbon $created_at
 */
#[Fillable([
    'store_id', 'user_id', 'actor', 'action', 'subject_type', 'subject_code',
    'subject_label', 'description', 'changes', 'flagged', 'reviewed_at', 'reviewed_by',
])]
class ActivityLog extends Model
{
    /**
     * Coarse activity categories so the owner can narrow the audit trail down
     * to the sensitive actions instead of scrolling thousands of mixed rows.
     * Rules are evaluated in order and the first match wins for a row's badge;
     * filtering is inclusive, so "Lelang" also returns a cancelled auction.
     *
     * @var array<string, array{label: string, action?: string, like?: array<int, string>}>
     */
    public const CATEGORIES = [
        'pembatalan' => ['label' => 'Pembatalan & Koreksi', 'like' => ['Membatalkan%']],
        'nominal' => ['label' => 'Ubah Nominal & Data', 'like' => ['Mengubah%', '%disesuaikan%']],
        'pencairan' => ['label' => 'Pencairan', 'like' => ['%pencairan%']],
        'tebus' => ['label' => 'Tebus & Perpanjang', 'like' => ['Menebus%', 'Memperpanjang%', 'Mengedit perpanjangan%']],
        'lelang' => ['label' => 'Lelang', 'like' => ['%lelang%']],
        'whatsapp' => ['label' => 'Kirim WhatsApp', 'like' => ['Mengirim%']],
        'hapus' => ['label' => 'Penghapusan Data', 'action' => 'deleted', 'like' => ['Menghapus%']],
        'baru' => ['label' => 'Data Baru', 'action' => 'created'],
    ];

    /**
     * Limit the log to one category from {@see self::CATEGORIES}.
     *
     * @param  Builder<ActivityLog>  $query
     */
    #[Scope]
    protected function category(Builder $query, string $key): void
    {
        $rules = self::CATEGORIES[$key] ?? null;

        if ($rules === null) {
            return;
        }

        $query->where(function (Builder $inner) use ($rules): void {
            if (isset($rules['action'])) {
                $inner->orWhere('action', $rules['action']);
            }

            foreach ($rules['like'] ?? [] as $pattern) {
                $inner->orWhere('description', 'like', $pattern);
            }
        });
    }

    /**
     * Free-text search across the code, label, description, and actor.
     *
     * @param  Builder<ActivityLog>  $query
     */
    #[Scope]
    protected function search(Builder $query, string $term): void
    {
        $like = '%'.addcslashes($term, '%_\\').'%';

        $query->where(function (Builder $inner) use ($like): void {
            $inner->where('subject_code', 'like', $like)
                ->orWhere('subject_label', 'like', $like)
                ->orWhere('description', 'like', $like)
                ->orWhere('actor', 'like', $like);
        });
    }

    /**
     * Sensitive entries the owner has not worked through yet.
     *
     * @param  Builder<ActivityLog>  $query
     */
    #[Scope]
    protected function needsReview(Builder $query): void
    {
        $query->where('flagged', true)->whereNull('reviewed_at');
    }

    /**
     * The category key this entry belongs to, or null when it fits none.
     */
    public function categoryKey(): ?string
    {
        foreach (self::CATEGORIES as $key => $rules) {
            foreach ($rules['like'] ?? [] as $pattern) {
                if (Str::is(str_replace('%', '*', $pattern), $this->description)) {
                    return $key;
                }
            }

            if (isset($rules['action']) && $this->action === $rules['action']) {
                return $key;
            }
        }

        return null;
    }

    protected function casts(): array
    {
        return [
            'changes' => 'array',
            'flagged' => 'boolean',
            'reviewed_at' => 'datetime',
        ];
    }

    /**
     * Record one audit entry for the current authenticated actor.
     *
     * @param  array<int, array{field: string, from: string|null, to: string|null}>|null  $changes
     * @param  bool  $flagged  Sensitive enough that the owner should review it.
     */
    public static function record(
        string $action,
        string $subjectType,
        ?string $subjectCode,
        ?string $subjectLabel,
        string $description,
        ?array $changes = null,
        bool $flagged = false,
    ): self {
        $user = Auth::user();

        return static::create([
            'store_id' => app(ActiveStore::class)->id(),
            'user_id' => $user?->id,
            'actor' => $user?->name ?? 'Sistem',
            'action' => $action,
            'subject_type' => $subjectType,
            'subject_code' => $subjectCode,
            'subject_label' => $subjectLabel,
            'description' => $description,
            'changes' => $changes ?: null,
            'flagged' => $flagged,
        ]);
    }

    /**
     * Field-level diff between two label => value snapshots.
     *
     * @param  array<string, string>  $before
     * @param  array<string, string>  $after
     * @return array<int, array{field: string, from: string, to: string}>
     */
    public static function diff(array $before, array $after): array
    {
        $changes = [];

        foreach ($after as $field => $newValue) {
            $oldValue = (string) ($before[$field] ?? '');

            if ($oldValue !== (string) $newValue) {
                $changes[] = [
                    'field' => $field,
                    'from' => $oldValue,
                    'to' => (string) $newValue,
                ];
            }
        }

        return $changes;
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
