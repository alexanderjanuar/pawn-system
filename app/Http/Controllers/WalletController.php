<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\CashEntry;
use App\Models\TransactionEvent;
use App\Models\Wallet;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class WalletController extends Controller
{
    public function index(Request $request): Response
    {
        $wallets = Wallet::query()
            ->orderBy('sort')
            ->orderBy('id')
            ->get();

        return Inertia::render('pengaturan/dompet', [
            'wallets' => $wallets->map(fn (Wallet $wallet): array => [
                'id' => $wallet->id,
                'name' => $wallet->name,
                'isDefault' => $wallet->is_default,
                'isActive' => $wallet->is_active,
                'usage' => $this->usageCount($wallet),
            ])->all(),
            'canManage' => $request->user()->isManagement(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60', Rule::unique('wallets', 'name')],
        ]);

        $wallet = Wallet::create([
            'name' => $data['name'],
            'is_default' => false,
            'is_active' => true,
            'sort' => (int) Wallet::query()->max('sort') + 1,
        ]);

        ActivityLog::record('created', 'dompet', $wallet->name, $wallet->name, 'Menambah dompet');

        return back()->with('success', "Dompet {$wallet->name} ditambahkan.");
    }

    public function update(Request $request, Wallet $wallet): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:60', Rule::unique('wallets', 'name')->ignore($wallet->id)],
            'is_active' => ['sometimes', 'boolean'],
            'is_default' => ['sometimes', 'boolean'],
        ]);

        // A deactivated or non-existent default would leave money unassignable.
        if (($data['is_active'] ?? true) === false && $wallet->is_default) {
            return back()->with('error', 'Dompet default tidak bisa dinonaktifkan. Jadikan dompet lain sebagai default dulu.');
        }

        if (($data['is_default'] ?? false) === true) {
            Wallet::query()->where('id', '!=', $wallet->id)->update(['is_default' => false]);
            $data['is_active'] = true;
        }

        $wallet->update($data);

        ActivityLog::record('updated', 'dompet', $wallet->name, $wallet->name, 'Memperbarui dompet');

        return back()->with('success', "Dompet {$wallet->name} diperbarui.");
    }

    public function destroy(Wallet $wallet): RedirectResponse
    {
        if ($wallet->is_default) {
            return back()->with('error', 'Dompet default tidak bisa dihapus.');
        }

        if ($this->usageCount($wallet) > 0) {
            return back()->with('error', "Dompet {$wallet->name} sudah dipakai di transaksi/kas. Nonaktifkan saja agar riwayat tetap utuh.");
        }

        $name = $wallet->name;
        $wallet->delete();

        ActivityLog::record('deleted', 'dompet', $name, $name, 'Menghapus dompet');

        return back()->with('success', "Dompet {$name} dihapus.");
    }

    /** How many cash movements reference this wallet (blocks a hard delete). */
    private function usageCount(Wallet $wallet): int
    {
        return TransactionEvent::query()->where('wallet_id', $wallet->id)->count()
            + CashEntry::query()->where('wallet_id', $wallet->id)->count();
    }
}
