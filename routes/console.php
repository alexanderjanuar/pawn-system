<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Tandai gadai yang lewat jatuh tempo 7 hari sebagai "Tidak Diambil" setiap
// dini hari (WITA). Butuh satu cron di server: `php artisan schedule:run`.
Schedule::command('gadai:mark-not-redeemed')
    ->dailyAt('01:00')
    ->timezone('Asia/Makassar');
