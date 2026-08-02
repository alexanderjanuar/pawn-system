<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Models\ActivityLog;
use App\Models\Store;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class PenggunaController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('pengaturan/akun', [
            'users' => User::query()
                ->with('store')
                ->orderByDesc('active')
                ->orderBy('name')
                ->get()
                ->map(fn (User $user): array => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role->value,
                    'roleLabel' => $user->role->label(),
                    'storeId' => $user->store_id,
                    'storeName' => $user->store?->name,
                    'active' => $user->active,
                ]),
            'roles' => collect(Role::cases())->map(fn (Role $role): array => [
                'value' => $role->value,
                'label' => $role->label(),
            ]),
            'stores' => Store::query()->active()->orderBy('name')->get(['id', 'name'])
                ->map(fn (Store $store): array => ['id' => $store->id, 'name' => $store->name]),
            'currentUserId' => $request->user()->id,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', Rule::unique('users', 'email')],
            'role' => ['required', Rule::enum(Role::class)],
            'store_id' => [$this->storeRule($request), 'nullable', 'integer', 'exists:stores,id'],
            'password' => ['required', 'string', Password::defaults()],
        ]);

        $role = Role::from($data['role']);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'role' => $role,
            'store_id' => $role === Role::Petugas ? ($data['store_id'] ?? null) : null,
            'password' => $data['password'],
            'active' => true,
            'email_verified_at' => now(),
        ]);

        ActivityLog::record('created', 'user', $user->email, $user->name, "Menambah akun ({$user->role->label()})");

        return back()->with('success', "Akun {$user->name} dibuat.");
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'email' => ['sometimes', 'required', 'email', 'max:190', Rule::unique('users', 'email')->ignore($user->id)],
            'role' => ['sometimes', 'required', Rule::enum(Role::class)],
            'store_id' => [$this->storeRule($request, $user), 'nullable', 'integer', 'exists:stores,id'],
            'active' => ['sometimes', 'boolean'],
        ]);

        $resultingRole = isset($data['role']) ? Role::from($data['role']) : $user->role;
        $resultingActive = array_key_exists('active', $data) ? (bool) $data['active'] : $user->active;
        $staysActiveManagement = $resultingActive && $resultingRole->isManagement();

        if ($user->id === $request->user()->id && array_key_exists('active', $data) && ! $resultingActive) {
            return back()->with('error', 'Tidak bisa menonaktifkan akun sendiri.');
        }

        if (! $this->managementRemains($user, $staysActiveManagement)) {
            return back()->with('error', 'Minimal harus ada satu akun Pemilik atau Admin yang aktif.');
        }

        if (isset($data['name'])) {
            $user->name = $data['name'];
        }
        if (isset($data['email'])) {
            $user->email = $data['email'];
        }
        if (isset($data['role'])) {
            $user->role = $resultingRole;
        }
        if (array_key_exists('active', $data)) {
            $user->active = $resultingActive;
        }
        // Petugas belong to a branch; management always span all stores.
        if ($resultingRole === Role::Petugas) {
            if (array_key_exists('store_id', $data)) {
                $user->store_id = $data['store_id'];
            }
        } else {
            $user->store_id = null;
        }
        $user->save();

        $description = match (true) {
            array_key_exists('active', $data) && count($data) === 1 => $resultingActive
                ? 'Mengaktifkan akun'
                : 'Menonaktifkan akun',
            default => 'Memperbarui akun',
        };

        ActivityLog::record('updated', 'user', $user->email, $user->name, $description);

        return back()->with('success', "Akun {$user->name} diperbarui.");
    }

    public function password(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'password' => ['required', 'string', Password::defaults()],
        ]);

        $user->update(['password' => $data['password']]);

        ActivityLog::record('updated', 'user', $user->email, $user->name, 'Mereset kata sandi');

        return back()->with('success', "Kata sandi {$user->name} direset.");
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        if ($user->id === $request->user()->id) {
            return back()->with('error', 'Tidak bisa menghapus akun sendiri.');
        }

        if (! $this->managementRemains($user, false)) {
            return back()->with('error', 'Minimal harus ada satu akun Pemilik atau Admin yang aktif.');
        }

        $name = $user->name;
        $email = $user->email;
        $user->delete();

        ActivityLog::record('deleted', 'user', $email, $name, 'Menghapus akun');

        return back()->with('success', "Akun {$name} dihapus.");
    }

    /**
     * A petugas account must be assigned to a store once stores exist. The rule
     * uses the incoming role, or the account's current role when unchanged.
     */
    private function storeRule(Request $request, ?User $user = null): \Illuminate\Validation\Rules\RequiredIf
    {
        $role = $request->input('role', $user?->role->value);

        return Rule::requiredIf(Store::query()->exists() && $role === Role::Petugas->value);
    }

    /**
     * Ensure at least one active management (Owner/Admin) account remains after
     * the intended change to $user, so nobody can lock everyone out.
     */
    private function managementRemains(User $user, bool $userStaysActiveManagement): bool
    {
        if ($userStaysActiveManagement) {
            return true;
        }

        return User::query()
            ->where('id', '!=', $user->id)
            ->where('active', true)
            ->whereIn('role', [Role::Admin->value, Role::Owner->value])
            ->exists();
    }
}
