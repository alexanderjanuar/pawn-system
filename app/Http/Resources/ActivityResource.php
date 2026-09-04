<?php

namespace App\Http\Resources;

use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ActivityLog
 */
class ActivityResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'actor' => $this->actor,
            'action' => $this->action,
            'subjectType' => $this->subject_type,
            'subjectCode' => $this->subject_code,
            'subjectLabel' => $this->subject_label,
            'description' => $this->description,
            'category' => $this->categoryKey(),
            'flagged' => (bool) $this->flagged,
            'reviewedAt' => $this->reviewed_at?->format('Y-m-d H.i'),
            'reviewedBy' => $this->reviewed_by,
            'changes' => $this->changes ?? [],
            'date' => $this->created_at->format('Y-m-d'),
            'time' => $this->created_at->format('H.i'),
        ];
    }
}
