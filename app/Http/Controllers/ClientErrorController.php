<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class ClientErrorController extends Controller
{
    /**
     * Record a crash that happened in the clerk's browser.
     *
     * A blank page tells nobody anything, and the shop's machines cannot be
     * inspected remotely, so the browser reports what it hit and the detail
     * lands in the normal Laravel log for us to read.
     */
    public function store(Request $request): Response
    {
        $data = $request->validate([
            'message' => ['required', 'string', 'max:500'],
            'stack' => ['nullable', 'string', 'max:4000'],
            'page' => ['nullable', 'string', 'max:200'],
            'url' => ['nullable', 'string', 'max:500'],
            'kind' => ['nullable', 'string', 'max:40'],
        ]);

        Log::error('Frontend crash: '.$data['message'], [
            'kind' => $data['kind'] ?? 'render',
            'page' => $data['page'] ?? null,
            'url' => $data['url'] ?? null,
            'user' => $request->user()?->name,
            'browser' => substr((string) $request->userAgent(), 0, 300),
            'stack' => $data['stack'] ?? null,
        ]);

        return response()->noContent();
    }
}
