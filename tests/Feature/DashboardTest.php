<?php

use App\Models\User;

test('guests are redirected to the login page', function () {
    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('login'));
});

test('management users can visit the dashboard', function () {
    $this->actingAs(User::factory()->owner()->create());

    $this->get(route('dashboard'))->assertOk();
});

test('petugas is redirected from the dashboard to their workspace', function () {
    $this->actingAs(User::factory()->petugas()->create());

    $this->get(route('dashboard'))->assertRedirect(route('transaksi.index'));
});