<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/** Bytes for an ini size such as "8M", the way PHP reads it. */
function iniToBytes(string $value): int
{
    $number = (int) $value;

    return match (strtolower(substr(trim($value), -1))) {
        'g' => $number * 1024 ** 3,
        'm' => $number * 1024 ** 2,
        'k' => $number * 1024,
        default => $number,
    };
}

test('every page tells the browser the server upload limits', function () {
    $this->actingAs(User::factory()->create())
        ->get('/transaksi')
        ->assertInertia(fn (Assert $page) => $page
            ->where('uploadLimits.perFile', iniToBytes((string) ini_get('upload_max_filesize')))
            ->where('uploadLimits.total', iniToBytes((string) ini_get('post_max_size'))),
        );
});

test('an over-limit request is answered with 413, which the form turns into a message', function () {
    $tooBig = iniToBytes((string) ini_get('post_max_size')) + 1;

    $this->actingAs(User::factory()->create())
        ->call('POST', '/gadai', [], [], [], [
            'CONTENT_LENGTH' => (string) $tooBig,
            'HTTP_X_INERTIA' => 'true',
        ])
        ->assertStatus(413);
});
