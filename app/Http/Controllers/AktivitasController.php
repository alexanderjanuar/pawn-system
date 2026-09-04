<?php

namespace App\Http\Controllers;

use App\Http\Resources\ActivityResource;
use App\Models\ActivityLog;
use App\Support\ActiveStore;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AktivitasController extends Controller
{
    /** Newest entries returned in one page of the log. */
    private const LIMIT = 300;

    public function index(Request $request): Response
    {
        $storeId = app(ActiveStore::class)->id();

        $flagged = $request->boolean('flagged');
        $search = trim((string) $request->query('q', ''));
        $actor = trim((string) $request->query('actor', ''));
        $category = (string) $request->query('category', '');
        $category = array_key_exists($category, ActivityLog::CATEGORIES) ? $category : '';

        $query = ActivityLog::query()
            ->when($storeId !== null, fn ($q) => $q->where('store_id', $storeId))
            ->when($search !== '', fn ($q) => $q->search($search))
            ->when($actor !== '', fn ($q) => $q->where('actor', $actor))
            ->when($category !== '', fn ($q) => $q->category($category))
            ->when($flagged, fn ($q) => $q->needsReview());

        $total = (clone $query)->count();

        $activities = $query->latest()->limit(self::LIMIT)->get();

        return Inertia::render('aktivitas', [
            'activities' => ActivityResource::collection($activities),
            'filters' => [
                'q' => $search,
                'actor' => $actor,
                'category' => $category,
                'flagged' => $flagged,
            ],
            'actors' => $this->actorOptions($storeId),
            'categories' => collect(ActivityLog::CATEGORIES)
                ->map(fn (array $rules, string $key): array => [
                    'key' => $key,
                    'label' => $rules['label'],
                ])
                ->values()
                ->all(),
            'total' => $total,
            'limit' => self::LIMIT,
        ]);
    }

    /**
     * Mark one flagged entry as worked through, so it leaves the owner's queue.
     */
    public function review(Request $request, ActivityLog $activityLog): RedirectResponse
    {
        $activityLog->update([
            'reviewed_at' => now(),
            'reviewed_by' => $request->user()?->name,
        ]);

        return back()->with('success', 'Ditandai sudah diperiksa.');
    }

    /**
     * Clear the whole queue for the active store in one go.
     */
    public function reviewAll(Request $request): RedirectResponse
    {
        $storeId = app(ActiveStore::class)->id();

        $count = ActivityLog::query()
            ->when($storeId !== null, fn ($q) => $q->where('store_id', $storeId))
            ->needsReview()
            ->update([
                'reviewed_at' => now(),
                'reviewed_by' => $request->user()?->name,
            ]);

        return back()->with('success', "{$count} catatan ditandai sudah diperiksa.");
    }

    /**
     * Every person who has left a trace in this store's log, for the filter.
     *
     * @return array<int, string>
     */
    private function actorOptions(?int $storeId): array
    {
        return ActivityLog::query()
            ->when($storeId !== null, fn ($q) => $q->where('store_id', $storeId))
            ->distinct()
            ->orderBy('actor')
            ->pluck('actor')
            ->all();
    }
}
