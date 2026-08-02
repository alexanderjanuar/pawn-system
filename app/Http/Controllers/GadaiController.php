<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreGadaiRequest;
use App\Http\Requests\UpdateGadaiRequest;
use App\Http\Resources\CustomerResource;
use App\Http\Resources\TransactionResource;
use App\Models\ActivityLog;
use App\Models\Clerk;
use App\Models\Customer;
use App\Models\Rak;
use App\Models\Setting;
use App\Models\Store;
use App\Models\Transaction;
use App\Support\ActiveStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class GadaiController extends Controller
{
    public function create(Request $request): Response|RedirectResponse
    {
        $storeId = $this->resolveStoreForWrite($request);

        if ($storeId === false) {
            return redirect()
                ->route('transaksi.index')
                ->with('error', 'Pilih satu toko dari pemilih toko di atas untuk membuat transaksi.');
        }

        $store = $storeId ? Store::find($storeId) : null;

        return Inertia::render('transaksi/create', [
            'customers' => CustomerResource::collection($this->customersWithHistory()),
            'petugasList' => $this->petugasOptions($storeId),
            'rakList' => $this->rakOptions($storeId),
            'suggestedCode' => Transaction::nextCode($store, now()),
            'notaPrefix' => $store?->notaPrefix() ?? 'GCG',
            'today' => now()->toDateString(),
        ]);
    }

    /**
     * Look up prior pawns that used the same IMEI, to warn the clerk. Matches
     * either IMEI slot; the current transaction (edit) can be excluded.
     */
    public function cekImei(Request $request): JsonResponse
    {
        $imei = trim((string) $request->query('imei', ''));
        $exclude = trim((string) $request->query('exclude', ''));

        if (strlen($imei) < 6) {
            return response()->json([]);
        }

        $matches = Transaction::query()
            ->with('customer')
            ->where(function ($q) use ($imei) {
                $q->where('imei_1', $imei)->orWhere('imei_2', $imei);
            })
            ->when($exclude !== '', fn ($q) => $q->where('code', '!=', $exclude))
            ->orderByDesc('start_date')
            ->limit(5)
            ->get()
            ->map(fn (Transaction $t) => [
                'code' => $t->code,
                'customer' => $t->customer->name,
                'device' => $t->device_name,
                'date' => $t->start_date->format('Y-m-d'),
                'status' => $t->status,
            ]);

        return response()->json($matches);
    }

    public function store(StoreGadaiRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $storeId = $this->resolveStoreForWrite($request);

        if ($storeId === false) {
            return back()->with('error', 'Pilih satu toko dari pemilih toko di atas untuk membuat transaksi.');
        }

        $store = $storeId ? Store::find($storeId) : null;
        $customer = $this->resolveCustomer($data);
        $terms = $this->terms($data);
        $startDate = Carbon::parse($data['start_date']);
        // Petugas is chosen per transaction (the account belongs to the shop,
        // not one clerk); fall back to the logged-in name if left blank.
        $clerk = ($data['clerk'] ?? '') ?: ($request->user()?->name ?? 'Petugas');

        // Loans above the configured threshold need Owner approval, unless the
        // creator is already management (owner/admin), who self-approve.
        $threshold = (int) Setting::get('approval_threshold', Transaction::APPROVAL_THRESHOLD);
        $isManagement = $request->user()?->isManagement() ?? false;
        $needsApproval = $terms['principal'] > $threshold && ! $isManagement;

        $transaction = $customer->transactions()->create([
            'store_id' => $storeId,
            'rak_id' => $data['rak_id'] ?? null,
            'code' => $data['code'] ?? Transaction::nextCode($store, $startDate),
            'device_owner' => ($data['device_owner'] ?? '') ?: $customer->name,
            'device_name' => $data['device_name'],
            'device_ram' => $data['device_ram'] ?? null,
            'device_storage' => $data['device_storage'] ?? null,
            'device_serial' => $data['device_serial'] ?? null,
            'imei_1' => $data['imei_1'] ?? null,
            'imei_2' => $data['imei_2'] ?? null,
            'kelengkapan' => $data['kelengkapan'],
            'principal' => $terms['principal'],
            'tenor_days' => $terms['days'],
            'fee_percent' => $terms['percent'],
            'fee' => $terms['fee'],
            'start_date' => $startDate,
            'due_date' => $startDate->copy()->addDays($terms['days']),
            'status' => 'AKTIF',
            'approval_status' => $needsApproval ? 'pending' : 'approved',
            'approved_by' => $needsApproval ? null : ($isManagement ? $clerk : null),
            'approved_at' => $needsApproval ? null : now(),
            'clerk' => $clerk,
            'notes' => $data['notes'] ?? null,
            'extensions' => 0,
            'photos' => $this->storePhotos($request),
            'ktp_path' => $request->file('ktp')?->store('gadai/ktp', 'public'),
        ]);

        $transaction->events()->create([
            'type' => 'created',
            'event_date' => $startDate,
            'title' => 'Gadai masuk',
            'by' => $clerk,
            'amount' => $terms['principal'],
        ]);

        ActivityLog::record(
            'created',
            'transaction',
            $transaction->code,
            $customer->name,
            $needsApproval ? 'Mengajukan transaksi (menunggu persetujuan)' : 'Membuat transaksi',
        );

        if ($needsApproval) {
            return redirect()
                ->route('transaksi.show', $transaction)
                ->with('success', "Transaksi {$transaction->code} menunggu persetujuan Pemilik sebelum dana dicairkan.");
        }

        $target = ! empty($data['cetak'])
            ? route('transaksi.nota', $transaction)
            : route('transaksi.show', $transaction);

        return redirect($target)->with('success', "Gadai {$transaction->code} berhasil dibuat.");
    }

    public function approve(Request $request, Transaction $transaction): RedirectResponse
    {
        if (! $transaction->isPendingApproval()) {
            return back()->with('error', 'Transaksi ini tidak sedang menunggu persetujuan.');
        }

        $transaction->update([
            'approval_status' => 'approved',
            'approved_by' => $request->user()?->name ?? 'Pemilik',
            'approved_at' => now(),
        ]);

        ActivityLog::record(
            'updated',
            'transaction',
            $transaction->code,
            $transaction->customer->name,
            'Menyetujui pencairan',
        );

        return back()->with('success', "Pencairan {$transaction->code} disetujui.");
    }

    public function reject(Request $request, Transaction $transaction): RedirectResponse
    {
        if (! $transaction->isPendingApproval()) {
            return back()->with('error', 'Transaksi ini tidak sedang menunggu persetujuan.');
        }

        $transaction->update([
            'approval_status' => 'rejected',
            'approved_by' => $request->user()?->name ?? 'Pemilik',
            'approved_at' => now(),
        ]);

        ActivityLog::record(
            'updated',
            'transaction',
            $transaction->code,
            $transaction->customer->name,
            'Menolak pencairan',
        );

        return back()->with('success', "Pencairan {$transaction->code} ditolak.");
    }

    public function edit(Transaction $transaction): Response
    {
        $transaction->load(['customer', 'events', 'rak']);

        return Inertia::render('transaksi/edit', [
            'transaction' => new TransactionResource($transaction),
            'customers' => CustomerResource::collection($this->customersWithHistory()),
            'petugasList' => $this->petugasOptions($transaction->store_id),
            'rakList' => $this->rakOptions($transaction->store_id),
        ]);
    }

    public function update(UpdateGadaiRequest $request, Transaction $transaction): RedirectResponse
    {
        $data = $request->validated();
        $customer = $this->resolveCustomer($data);
        $terms = $this->terms($data);
        $startDate = Carbon::parse($data['start_date']);

        $clerk = ($data['clerk'] ?? '') ?: $transaction->clerk;
        $rakId = $data['rak_id'] ?? null;
        $newRakName = $rakId ? (Rak::find($rakId)?->name ?? '—') : '—';

        $before = [
            'Pelanggan' => $transaction->customer->name,
            'Petugas' => $transaction->clerk,
            'Rak' => $transaction->rak?->name ?? '—',
            'Dana titipan' => $this->rupiah($transaction->principal),
            'Biaya titipan' => $this->rupiah($transaction->fee),
            'Status' => $transaction->status,
            'Jangka waktu' => $transaction->tenor_days.' hari',
            'Nama HP' => $transaction->device_name,
            'Tanggal masuk' => $transaction->start_date->format('Y-m-d'),
        ];

        $ktpPath = $transaction->ktp_path;
        if ($request->hasFile('ktp')) {
            if ($ktpPath) {
                Storage::disk('public')->delete($ktpPath);
            }
            $ktpPath = $request->file('ktp')->store('gadai/ktp', 'public');
        }

        $transaction->update([
            'customer_id' => $customer->id,
            'device_owner' => ($data['device_owner'] ?? '') ?: $customer->name,
            'device_name' => $data['device_name'],
            'device_ram' => $data['device_ram'] ?? null,
            'device_storage' => $data['device_storage'] ?? null,
            'device_serial' => $data['device_serial'] ?? null,
            'imei_1' => $data['imei_1'] ?? null,
            'imei_2' => $data['imei_2'] ?? null,
            'kelengkapan' => $data['kelengkapan'],
            'status' => $data['status'],
            'clerk' => $clerk,
            'rak_id' => $rakId,
            'principal' => $terms['principal'],
            'tenor_days' => $terms['days'],
            'fee_percent' => $terms['percent'],
            'fee' => $terms['fee'],
            'start_date' => $startDate,
            'due_date' => $startDate->copy()->addDays($terms['days']),
            'notes' => $data['notes'] ?? null,
            'photos' => array_values(array_merge(
                $transaction->photos ?? [],
                $this->storePhotos($request),
            )),
            'ktp_path' => $ktpPath,
        ]);

        $after = [
            'Pelanggan' => $customer->name,
            'Petugas' => $clerk,
            'Rak' => $newRakName,
            'Dana titipan' => $this->rupiah($terms['principal']),
            'Biaya titipan' => $this->rupiah($terms['fee']),
            'Status' => $data['status'],
            'Jangka waktu' => $terms['days'].' hari',
            'Nama HP' => $data['device_name'],
            'Tanggal masuk' => $startDate->format('Y-m-d'),
        ];

        $changes = ActivityLog::diff($before, $after);

        if ($changes !== []) {
            ActivityLog::record(
                'updated',
                'transaction',
                $transaction->code,
                $customer->name,
                'Mengubah '.collect($changes)->pluck('field')->implode(', '),
                $changes,
            );
        }

        return redirect()
            ->route('transaksi.show', $transaction)
            ->with('success', "Transaksi {$transaction->code} diperbarui.");
    }

    public function destroy(Transaction $transaction): RedirectResponse
    {
        foreach ($transaction->photos ?? [] as $photo) {
            $path = is_array($photo) ? ($photo['path'] ?? null) : $photo;

            if ($path) {
                Storage::disk('public')->delete($path);
            }
        }
        if ($transaction->ktp_path) {
            Storage::disk('public')->delete($transaction->ktp_path);
        }

        $code = $transaction->code;
        $customerName = $transaction->customer->name;
        $transaction->delete();

        ActivityLog::record(
            'deleted',
            'transaction',
            $code,
            $customerName,
            'Menghapus transaksi',
        );

        return redirect()
            ->route('transaksi.index')
            ->with('success', "Transaksi {$code} dihapus.");
    }

    public function lelang(Request $request, Transaction $transaction): RedirectResponse
    {
        if (in_array($transaction->status, ['DIAMBIL', 'LELANG'], true)) {
            return back()->with('error', 'Transaksi ini tidak bisa ditandai lelang.');
        }

        $transaction->update(['status' => 'LELANG']);

        $transaction->events()->create([
            'type' => 'auctioned',
            'event_date' => now(),
            'title' => 'Ditandai untuk lelang',
            'by' => $request->user()?->name,
        ]);

        ActivityLog::record(
            'updated',
            'transaction',
            $transaction->code,
            $transaction->customer->name,
            'Menandai barang untuk lelang',
        );

        return back()->with('success', "Transaksi {$transaction->code} ditandai lelang.");
    }

    public function recordSale(Request $request, Transaction $transaction): RedirectResponse
    {
        if ($transaction->status !== 'LELANG') {
            return back()->with('error', 'Hanya barang lelang yang bisa dicatat penjualannya.');
        }

        $data = $request->validate([
            'sale_value' => ['required', 'integer', 'min:0'],
        ]);

        $transaction->update([
            'sale_value' => $data['sale_value'],
            'sold_at' => now(),
        ]);

        $transaction->events()->create([
            'type' => 'auctioned',
            'event_date' => now(),
            'title' => 'Terjual lelang',
            'by' => $request->user()?->name,
            'amount' => $data['sale_value'],
        ]);

        ActivityLog::record(
            'updated',
            'transaction',
            $transaction->code,
            $transaction->customer->name,
            'Mencatat penjualan lelang: '.$this->rupiah($data['sale_value']),
        );

        return back()->with('success', "Penjualan {$transaction->code} dicatat.");
    }

    private function rupiah(int $amount): string
    {
        return 'Rp '.number_format($amount, 0, ',', '.');
    }

    /**
     * Active petugas on the roster for the given store, for the form select.
     * A null store (single-shop / all) returns every active petugas.
     *
     * @return array<int, string>
     */
    private function petugasOptions(?int $storeId): array
    {
        return Clerk::query()
            ->active()
            ->when($storeId !== null, fn ($query) => $query->where('store_id', $storeId))
            ->orderBy('name')
            ->pluck('name')
            ->all();
    }

    /**
     * The store a new transaction belongs to. Petugas are locked to their
     * branch; management use the active store. Returns false when a management
     * user is viewing "all stores" and must pick one first; null in a
     * single-shop setup with no stores yet.
     */
    private function resolveStoreForWrite(Request $request): int|false|null
    {
        $user = $request->user();

        if (! $user->isManagement()) {
            return $user->store_id;
        }

        $activeId = app(ActiveStore::class)->id();

        if ($activeId !== null) {
            return $activeId;
        }

        return Store::query()->exists() ? false : null;
    }

    /**
     * Active racks for the given store, for the transaction form select.
     * A null store returns every active rack.
     *
     * @return array<int, array{id: int, name: string}>
     */
    private function rakOptions(?int $storeId): array
    {
        return Rak::query()
            ->active()
            ->when($storeId !== null, fn ($query) => $query->where('store_id', $storeId))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Rak $rak): array => ['id' => $rak->id, 'name' => $rak->name])
            ->all();
    }

    /**
     * Customers with their transactions eager-loaded (newest first), so the
     * form can show an existing customer's pawn history inline.
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, Customer>
     */
    private function customersWithHistory(): \Illuminate\Database\Eloquent\Collection
    {
        return Customer::query()
            ->with(['transactions' => fn ($query) => $query->orderByDesc('start_date')])
            ->orderBy('name')
            ->get();
    }

    /**
     * Store uploaded photos with their optional label (Depan, Belakang, …).
     *
     * @return array<int, array{path: string, label: string|null}>
     */
    private function storePhotos(Request $request): array
    {
        $labels = $request->input('photo_labels', []);

        return collect($request->file('photos') ?? [])
            ->map(fn (UploadedFile $file, int $i) => [
                'path' => $file->store('gadai/photos', 'public'),
                'label' => $labels[$i] ?? null,
            ])
            ->all();
    }

    /**
     * Resolve tenor days, percent, fee and principal from the request data.
     *
     * @param  array<string, mixed>  $data
     * @return array{principal: int, days: int, percent: int, fee: int}
     */
    private function terms(array $data): array
    {
        $days = match ($data['tenor_choice']) {
            '15' => 15,
            '30' => 30,
            default => (int) $data['custom_days'],
        };
        $percent = match ($data['tenor_choice']) {
            '15' => 10,
            '30' => 15,
            default => (int) $data['custom_percent'],
        };
        $principal = (int) $data['principal'];

        return [
            'principal' => $principal,
            'days' => $days,
            'percent' => $percent,
            'fee' => (int) round($principal * $percent / 100),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function resolveCustomer(array $data): Customer
    {
        if ($data['customer_mode'] === 'existing') {
            return Customer::where('code', $data['customer_code'])->firstOrFail();
        }

        return Customer::create([
            'code' => Customer::nextCode(),
            'name' => $data['name'],
            'phone' => $data['phone'],
            'address' => $data['address'] ?? null,
            'id_number' => $data['id_number'] ?? null,
            'join_date' => Carbon::parse($data['start_date']),
        ]);
    }
}
