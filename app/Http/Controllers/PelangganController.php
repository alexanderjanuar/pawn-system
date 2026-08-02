<?php

namespace App\Http\Controllers;

use App\Http\Resources\CustomerResource;
use App\Http\Resources\TransactionResource;
use App\Models\ActivityLog;
use App\Models\Customer;
use App\Models\Transaction;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PelangganController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('pelanggan/index', [
            'customers' => CustomerResource::collection(
                Customer::query()->orderBy('name')->get(),
            ),
            'transactions' => TransactionResource::collection(
                Transaction::with(['customer', 'events'])->get(),
            ),
        ]);
    }

    public function show(Customer $customer): Response
    {
        $transactions = $customer->transactions()
            ->with(['customer', 'events'])
            ->orderByDesc('start_date')
            ->get();

        return Inertia::render('pelanggan/show', [
            'customer' => new CustomerResource($customer),
            'transactions' => TransactionResource::collection($transactions),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['required', 'string', 'max:40'],
            'address' => ['nullable', 'string', 'max:255'],
            'id_number' => ['nullable', 'string', 'max:40'],
        ]);

        $customer = Customer::create([
            'code' => Customer::nextCode(),
            'name' => $data['name'],
            'phone' => $data['phone'],
            'address' => $data['address'] ?? null,
            'id_number' => $data['id_number'] ?? null,
            'join_date' => now(),
        ]);

        ActivityLog::record(
            'created',
            'customer',
            $customer->code,
            $customer->name,
            'Menambah pelanggan',
        );

        return redirect()
            ->route('pelanggan.show', $customer)
            ->with('success', "Pelanggan {$customer->name} ditambahkan.");
    }

    public function update(Request $request, Customer $customer): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['required', 'string', 'max:40'],
            'address' => ['nullable', 'string', 'max:255'],
            'id_number' => ['nullable', 'string', 'max:40'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $before = [
            'Nama' => $customer->name,
            'No. HP' => $customer->phone,
            'Alamat' => (string) $customer->address,
            'No. KTP' => (string) $customer->id_number,
            'Catatan' => (string) $customer->notes,
        ];

        $customer->update($data);

        $after = [
            'Nama' => $customer->name,
            'No. HP' => $customer->phone,
            'Alamat' => (string) $customer->address,
            'No. KTP' => (string) $customer->id_number,
            'Catatan' => (string) $customer->notes,
        ];

        $changes = ActivityLog::diff($before, $after);

        if ($changes !== []) {
            ActivityLog::record(
                'updated',
                'customer',
                $customer->code,
                $customer->name,
                'Mengubah '.collect($changes)->pluck('field')->implode(', '),
                $changes,
            );
        }

        return redirect()
            ->route('pelanggan.show', $customer)
            ->with('success', "Data {$customer->name} diperbarui.");
    }

    public function destroy(Customer $customer): RedirectResponse
    {
        if ($customer->transactions()->exists()) {
            return back()->with(
                'error',
                'Pelanggan tidak bisa dihapus karena masih punya transaksi.',
            );
        }

        $name = $customer->name;
        $code = $customer->code;
        $customer->delete();

        ActivityLog::record(
            'deleted',
            'customer',
            $code,
            $name,
            'Menghapus pelanggan',
        );

        return redirect()
            ->route('pelanggan.index')
            ->with('success', "Pelanggan {$name} dihapus.");
    }

    public function blacklist(Request $request, Customer $customer): RedirectResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:120'],
        ]);

        $customer->update([
            'blacklisted_at' => now(),
            'blacklist_reason' => $data['reason'],
        ]);

        ActivityLog::record(
            'updated',
            'customer',
            $customer->code,
            $customer->name,
            'Blacklist pelanggan: '.$data['reason'],
        );

        return back()->with('success', "{$customer->name} ditandai blacklist.");
    }

    public function unblacklist(Customer $customer): RedirectResponse
    {
        $customer->update([
            'blacklisted_at' => null,
            'blacklist_reason' => null,
        ]);

        ActivityLog::record(
            'updated',
            'customer',
            $customer->code,
            $customer->name,
            'Mencabut blacklist pelanggan',
        );

        return back()->with('success', "Blacklist {$customer->name} dicabut.");
    }
}
