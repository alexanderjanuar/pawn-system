<?php

use App\Enums\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;

test('the akun page lists accounts and roles', function () {
    User::factory()->owner()->create();

    $this->actingAs(User::factory()->owner()->create())
        ->get('/pengaturan/akun')
        ->assertInertia(fn (Assert $page) => $page
            ->component('pengaturan/akun')
            ->has('users')
            ->has('roles', 3)
            ->has('currentUserId'),
        );
});

test('owner can create a login account', function () {
    $this->actingAs(User::factory()->owner()->create())
        ->post('/pengaturan/akun', [
            'name' => 'Siti',
            'email' => 'siti@gulamcell.test',
            'role' => 'petugas',
            'password' => 'rahasia12345',
        ])
        ->assertRedirect();

    $user = User::where('email', 'siti@gulamcell.test')->first();

    expect($user)->not->toBeNull()
        ->and($user->role)->toBe(Role::Petugas)
        ->and($user->active)->toBeTrue()
        ->and(Hash::check('rahasia12345', $user->password))->toBeTrue();
});

test('account email must be unique', function () {
    User::factory()->create(['email' => 'dobel@x.test']);

    $this->actingAs(User::factory()->owner()->create())
        ->post('/pengaturan/akun', [
            'name' => 'X',
            'email' => 'dobel@x.test',
            'role' => 'petugas',
            'password' => 'rahasia12345',
        ])
        ->assertSessionHasErrors('email');
});

test('owner can update name, email, and role', function () {
    $owner = User::factory()->owner()->create();
    $staff = User::factory()->petugas()->create();

    $this->actingAs($owner)
        ->put("/pengaturan/akun/{$staff->id}", [
            'name' => 'Nama Baru',
            'email' => 'baru@x.test',
            'role' => 'admin',
        ])
        ->assertRedirect();

    $staff->refresh();
    expect($staff->name)->toBe('Nama Baru')
        ->and($staff->email)->toBe('baru@x.test')
        ->and($staff->role)->toBe(Role::Admin);
});

test('owner can reset another account password', function () {
    $owner = User::factory()->owner()->create();
    $staff = User::factory()->petugas()->create();

    $this->actingAs($owner)
        ->put("/pengaturan/akun/{$staff->id}/password", ['password' => 'sandibaru123'])
        ->assertRedirect();

    expect(Hash::check('sandibaru123', $staff->fresh()->password))->toBeTrue();
});

test('owner can deactivate another account', function () {
    $owner = User::factory()->owner()->create();
    $staff = User::factory()->petugas()->create(['active' => true]);

    $this->actingAs($owner)
        ->put("/pengaturan/akun/{$staff->id}", ['active' => false])
        ->assertRedirect();

    expect($staff->fresh()->active)->toBeFalse();
});

test('a deactivated account cannot log in', function () {
    User::factory()->petugas()->create([
        'email' => 'nonaktif@x.test',
        'password' => 'password',
        'active' => false,
    ]);

    $this->post(route('login.store'), [
        'email' => 'nonaktif@x.test',
        'password' => 'password',
    ])->assertSessionHasErrors('email');

    $this->assertGuest();
});

test('an active account can still log in', function () {
    $user = User::factory()->petugas()->create([
        'email' => 'aktif@x.test',
        'password' => 'password',
        'active' => true,
    ]);

    $this->post(route('login.store'), [
        'email' => 'aktif@x.test',
        'password' => 'password',
    ]);

    $this->assertAuthenticatedAs($user);
});

test('an owner cannot deactivate their own account', function () {
    $owner = User::factory()->owner()->create();

    $this->actingAs($owner)
        ->put("/pengaturan/akun/{$owner->id}", ['active' => false]);

    expect($owner->fresh()->active)->toBeTrue();
});

test('an owner cannot delete their own account', function () {
    $owner = User::factory()->owner()->create();

    $this->actingAs($owner)->delete("/pengaturan/akun/{$owner->id}");

    expect(User::find($owner->id))->not->toBeNull();
});

test('the last active management account cannot demote itself', function () {
    $owner = User::factory()->owner()->create();

    $this->actingAs($owner)
        ->put("/pengaturan/akun/{$owner->id}", ['role' => 'petugas']);

    expect($owner->fresh()->role)->toBe(Role::Owner);
});

test('petugas role cannot manage accounts', function () {
    $staff = User::factory()->petugas()->create();
    $target = User::factory()->petugas()->create();

    $this->actingAs($staff)->get('/pengaturan/akun')->assertForbidden();
    $this->actingAs($staff)->post('/pengaturan/akun', [
        'name' => 'X', 'email' => 'x@x.test', 'role' => 'petugas', 'password' => 'rahasia12345',
    ])->assertForbidden();
    $this->actingAs($staff)->put("/pengaturan/akun/{$target->id}", ['name' => 'Y'])->assertForbidden();
    $this->actingAs($staff)->put("/pengaturan/akun/{$target->id}/password", ['password' => 'rahasia12345'])->assertForbidden();
    $this->actingAs($staff)->delete("/pengaturan/akun/{$target->id}")->assertForbidden();
});
