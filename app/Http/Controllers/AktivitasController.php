<?php

namespace App\Http\Controllers;

use App\Http\Resources\ActivityResource;
use App\Models\ActivityLog;
use App\Support\ActiveStore;
use Inertia\Inertia;
use Inertia\Response;

class AktivitasController extends Controller
{
    public function index(): Response
    {
        $storeId = app(ActiveStore::class)->id();

        $activities = ActivityLog::query()
            ->when($storeId !== null, fn ($query) => $query->where('store_id', $storeId))
            ->latest()
            ->limit(300)
            ->get();

        return Inertia::render('aktivitas', [
            'activities' => ActivityResource::collection($activities),
        ]);
    }
}
