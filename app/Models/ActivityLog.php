<?php

namespace App\Models;

use App\Support\ActiveStore;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Auth;

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
 * @property \Illuminate\Support\Carbon $created_at
 */
#[Fillable([
    'store_id', 'user_id', 'actor', 'action', 'subject_type', 'subject_code',
    'subject_label', 'description', 'changes',
])]
class ActivityLog extends Model
{
    protected function casts(): array
    {
        return [
            'changes' => 'array',
        ];
    }

    /**
     * Record one audit entry for the current authenticated actor.
     *
     * @param  array<int, array{field: string, from: string|null, to: string|null}>|null  $changes
     */
    public static function record(
        string $action,
        string $subjectType,
        ?string $subjectCode,
        ?string $subjectLabel,
        string $description,
        ?array $changes = null,
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
