<?php

use App\Enums\Role;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('petugas cannot reach owner-only settings', function () {
    $this->actingAs(User::factory()->petugas()->create())
        ->get('/pengaturan/biaya')
        ->assertForbidden();

    $this->actingAs(User::factory()->petugas()->create())
        ->get('/pengaturan/petugas')
        ->assertForbidden();
});

test('owner can reach owner-only settings', function () {
    $this->actingAs(User::factory()->owner()->create())
        ->get('/pengaturan/biaya')
        ->assertOk();
});

test('admin can reach owner-only settings', function () {
    $this->actingAs(User::factory()->admin()->create())
        ->get('/pengaturan/petugas')
        ->assertOk();
});

test('petugas keeps access to operational pages', function () {
    $this->actingAs(User::factory()->petugas()->create())
        ->get('/transaksi')
        ->assertOk();
});

test('the authenticated user exposes role and label to the frontend', function () {
    $this->actingAs(User::factory()->owner()->create())
        ->get('/dashboard')
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.role', 'owner')
            ->where('auth.user.role_label', 'Pemilik'),
        );
});

test('role helpers classify management correctly', function () {
    expect(User::factory()->admin()->create()->isManagement())->toBeTrue()
        ->and(User::factory()->owner()->create()->isManagement())->toBeTrue()
        ->and(User::factory()->petugas()->create()->isManagement())->toBeFalse()
        ->and(User::factory()->owner()->create()->hasRole(Role::Owner))->toBeTrue();
});
