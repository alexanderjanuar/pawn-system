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
use App\Models\Wallet;
use App\Services\Fonnte;
use App\Support\ActiveStore;
use Illuminate\Database\Eloquent\Collection;
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

        // Only warn about pawns still physically held (not yet redeemed/sold);
        // an IMEI whose device was already taken back can be pawned again.
        $matches = Transaction::query()
            ->with('customer')
            ->held()
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
            ...$this->deviceAttributes($data),
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

        $funding = $this->resolveFunding($data['wallet_split'] ?? null, $data['wallet_id'] ?? null);

        $transaction->events()->create([
            'type' => 'created',
            'event_date' => $startDate,
            'title' => 'Gadai masuk',
            'by' => $clerk,
            'amount' => $terms['principal'],
            'wallet_id' => $funding['wallet_id'],
            'wallet_split' => $funding['wallet_split'],
        ]);

        ActivityLog::record(
            'created',
            'transaction',
            $transaction->code,
            $customer->name,
            $needsApproval ? 'Mengajukan transaksi (menunggu persetujuan)' : 'Membuat transaksi',
        );

        if ($needsApproval) {
            $this->notifyOwnerNeedsApproval($transaction, $customer, $terms['principal'], $threshold, $clerk, $store);

            return redirect()
                ->route('transaksi.show', $transaction)
                ->with('success', "Transaksi {$transaction->code} menunggu persetujuan Pemilik sebelum dana dicairkan.");
        }

        $target = ! empty($data['cetak'])
            ? route('transaksi.nota', $transaction)
            : route('transaksi.show', $transaction);

        $message = "Gadai {$transaction->code} berhasil dibuat.";

        // Optionally hand the customer their nota over WhatsApp right away.
        if (! empty($data['kirim_wa']) && filled($customer->phone)) {
            $result = $this->deliverNota($transaction, null, $clerk);
            $message .= $result['sent']
                ? ' Nota terkirim ke WhatsApp pelanggan.'
                : ' Namun nota gagal dikirim ke WhatsApp.';
        }

        return redirect($target)->with('success', $message);
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

        // An extended loan's schedule is owned by Perpanjang. Editing it (e.g.
        // to fix the rack) must never recompute the due date from
        // start_date + tenor, which would wrongly revert it to the
        // pre-extension due date and make it look overdue again.
        $extended = $transaction->extensions > 0;
        $tenorDays = $extended ? $transaction->tenor_days : $terms['days'];
        $dueDate = $extended
            ? $transaction->due_date
            : $startDate->copy()->addDays($terms['days']);

        // Audit: editing the nominal (principal/fee) requires a reason.
        $nominalChanged = (int) $terms['principal'] !== (int) $transaction->principal
            || (int) $terms['fee'] !== (int) $transaction->fee;
        $reason = trim((string) ($data['change_reason'] ?? ''));

        if ($nominalChanged && $reason === '') {
            return back()->withErrors(['change_reason' => 'Alasan perubahan nominal wajib diisi.'])->withInput();
        }

        $clerk = ($data['clerk'] ?? '') ?: $transaction->clerk;
        $rakId = $data['rak_id'] ?? null;
        $newRakName = $rakId ? (Rak::find($rakId)?->name ?? '—') : '—';

        $feeBefore = (int) $transaction->fee;

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
            ...$this->deviceAttributes($data),
            'kelengkapan' => $data['kelengkapan'],
            'status' => $data['status'],
            'clerk' => $clerk,
            'rak_id' => $rakId,
            'principal' => $terms['principal'],
            'tenor_days' => $tenorDays,
            'fee_percent' => $terms['percent'],
            'fee' => $terms['fee'],
            'start_date' => $startDate,
            'due_date' => $dueDate,
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
            'Jangka waktu' => $tenorDays.' hari',
            'Nama HP' => $data['device_name'],
            'Tanggal masuk' => $startDate->format('Y-m-d'),
        ];

        $changes = ActivityLog::diff($before, $after);

        if ($changes !== []) {
            $description = 'Mengubah '.collect($changes)->pluck('field')->implode(', ');

            if ($nominalChanged && $reason !== '') {
                $description .= " (Alasan: {$reason})";
            }

            ActivityLog::record(
                'updated',
                'transaction',
                $transaction->code,
                $customer->name,
                $description,
                $changes,
                $this->exceedsDiscountLimit($feeBefore, (int) $terms['fee']),
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
            null,
            true,
        );

        return redirect()
            ->route('transaksi.index')
            ->with('success', "Transaksi {$code} dihapus.");
    }

    public function redeem(Request $request, Transaction $transaction): RedirectResponse
    {
        if (! in_array($transaction->status, ['AKTIF', 'PERPANJANG', 'TIDAK_DIAMBIL'], true)) {
            return back()->with('error', 'Transaksi ini tidak bisa ditebus.');
        }

        $data = $request->validate([
            'payment_method' => ['nullable', 'in:cash,transfer'],
            'wallet_id' => ['nullable', 'integer', 'exists:wallets,id'],
            // Optional adjusted deposit fee (e.g. redeemed early) — no separate edit needed.
            'fee' => ['nullable', 'integer', 'min:0'],
            // Audit: a reason is mandatory whenever the fee is adjusted.
            'reason' => ['nullable', 'string', 'max:200'],
            // Optional redemption date (default today) — lands in Kas on that day.
            'date' => [
                'nullable', 'date',
                'after_or_equal:'.$transaction->start_date->toDateString(),
                'before_or_equal:today',
            ],
        ]);

        $redeemDate = ! empty($data['date']) ? $data['date'] : now()->toDateString();

        // Use the adjusted fee when given; keep records consistent by storing it.
        $adjusted = array_key_exists('fee', $data) && $data['fee'] !== null
            && (int) $data['fee'] !== (int) $transaction->fee;

        if ($adjusted && blank($data['reason'] ?? null)) {
            return back()->withErrors(['reason' => 'Alasan penyesuaian biaya wajib diisi.']);
        }

        $fee = $adjusted ? (int) $data['fee'] : (int) $transaction->fee;
        $percent = $transaction->principal > 0
            ? (int) round($fee / $transaction->principal * 100)
            : 0;
        $reason = trim((string) ($data['reason'] ?? ''));
        $feeBefore = (int) $transaction->fee;

        $transaction->update([
            'status' => 'DIAMBIL',
            'fee' => $fee,
            'fee_percent' => $percent,
        ]);

        $transaction->events()->create([
            'type' => 'redeemed',
            'event_date' => $redeemDate,
            'title' => 'Ditebus & diambil',
            'note' => $adjusted
                ? 'Biaya titipan disesuaikan menjadi '.$this->rupiah($fee).'. Alasan: '.$reason.'.'
                : null,
            'by' => $request->user()?->name,
            'amount' => $transaction->principal + $fee,
            'payment_method' => $data['payment_method'] ?? 'cash',
            'wallet_id' => $this->resolveWallet($data['wallet_id'] ?? null),
        ]);

        $overLimit = $adjusted && $this->exceedsDiscountLimit($feeBefore, $fee);

        ActivityLog::record(
            'updated',
            'transaction',
            $transaction->code,
            $transaction->customer->name,
            'Menebus & mengambil barang'.($adjusted ? " (biaya disesuaikan: {$reason})" : ''),
            null,
            $overLimit,
        );

        return back()->with('success', "Transaksi {$transaction->code} ditebus & diambil.");
    }

    public function extend(Request $request, Transaction $transaction): RedirectResponse
    {
        if (! in_array($transaction->status, ['AKTIF', 'PERPANJANG', 'TIDAK_DIAMBIL'], true)) {
            return back()->with('error', 'Transaksi ini tidak bisa diperpanjang.');
        }

        $data = $request->validate([
            'mode' => ['required', 'in:15,30,custom'],
            'until' => ['required_if:mode,custom', 'nullable', 'date', 'after:'.$transaction->due_date->toDateString()],
            'fee' => ['required_if:mode,custom', 'nullable', 'integer', 'min:0'],
            // The customer must pay the deposit fee (interest) up front to extend.
            'fee_paid' => ['accepted'],
            'payment_method' => ['nullable', 'in:cash,transfer'],
            'wallet_id' => ['nullable', 'integer', 'exists:wallets,id'],
        ], [
            'fee_paid.accepted' => 'Pastikan pelanggan sudah membayar biaya titipan sebelum memperpanjang.',
        ]);

        $principal = $transaction->principal;
        $currentDue = $transaction->due_date;

        if ($data['mode'] === 'custom') {
            $newDue = Carbon::parse($data['until']);
            $fee = (int) ($data['fee'] ?? 0);
            $percent = $principal > 0 ? (int) round($fee / $principal * 100) : 0;
        } else {
            // The extension fee follows the transaction's own interest rate,
            // not the extension length: 15 and 30 days both cost that rate.
            $days = (int) $data['mode'];
            $percent = $transaction->fee_percent;
            $newDue = $currentDue->copy()->addDays($days);
            $fee = (int) round($principal * $percent / 100);
        }

        $transaction->update([
            'status' => 'PERPANJANG',
            'due_date' => $newDue,
            'tenor_days' => (int) $currentDue->diffInDays($newDue),
            'fee' => $fee,
            'fee_percent' => $percent,
            'extensions' => $transaction->extensions + 1,
        ]);

        $transaction->events()->create([
            'type' => 'extended',
            'event_date' => now(),
            'title' => 'Diperpanjang s/d '.$newDue->format('d M Y'),
            'note' => 'Biaya titipan '.$this->rupiah($fee).' dibayar.',
            'by' => $request->user()?->name,
            'amount' => $fee,
            'payment_method' => $data['payment_method'] ?? 'cash',
            'wallet_id' => $this->resolveWallet($data['wallet_id'] ?? null),
        ]);

        ActivityLog::record(
            'updated',
            'transaction',
            $transaction->code,
            $transaction->customer->name,
            'Memperpanjang s/d '.$newDue->format('Y-m-d'),
        );

        return back()->with('success', "Gadai {$transaction->code} diperpanjang s/d ".$newDue->format('d M Y').'.');
    }

    /**
     * Undo the most recent extension (e.g. an accidental double perpanjang):
     * roll the due date back by the last period, drop the extension count, and
     * remove its payment record so it no longer counts as income or cash.
     */
    public function revertExtend(Request $request, Transaction $transaction): RedirectResponse
    {
        if ($transaction->extensions < 1) {
            return back()->with('error', 'Transaksi ini tidak punya perpanjangan untuk dibatalkan.');
        }

        if (in_array($transaction->status, ['DIAMBIL', 'LELANG'], true)) {
            return back()->with('error', 'Perpanjangan tidak bisa dibatalkan pada transaksi yang sudah diambil atau lelang.');
        }

        // tenor_days always holds the most recent extension's length, so this
        // exactly reverses the last perpanjang.
        $previousDue = $transaction->due_date->copy()->subDays($transaction->tenor_days);
        $remaining = $transaction->extensions - 1;

        $transaction->events()
            ->where('type', 'extended')
            ->latest('id')
            ->first()
            ?->delete();

        $transaction->update([
            'due_date' => $previousDue,
            'extensions' => $remaining,
            'status' => $remaining === 0 ? 'AKTIF' : 'PERPANJANG',
        ]);

        ActivityLog::record(
            'updated',
            'transaction',
            $transaction->code,
            $transaction->customer->name,
            'Membatalkan perpanjangan (jatuh tempo kembali ke '.$previousDue->format('Y-m-d').')',
            null,
            true,
        );

        return back()->with('success', "Perpanjangan {$transaction->code} dibatalkan.");
    }

    /**
     * Edit the most recent extension in place (e.g. a perpanjang recorded with
     * the wrong length or fee) instead of cancel-and-redo. The extension's
     * payment record keeps its original date & method, so income and the daily
     * cash stay on the right day and are never doubled. The current period's
     * start stays fixed; only its end (and length) moves.
     */
    public function editExtend(Request $request, Transaction $transaction): RedirectResponse
    {
        if ($transaction->extensions < 1) {
            return back()->with('error', 'Transaksi ini belum pernah diperpanjang.');
        }

        if (in_array($transaction->status, ['DIAMBIL', 'LELANG'], true)) {
            return back()->with('error', 'Perpanjangan tidak bisa diedit pada transaksi yang sudah diambil atau lelang.');
        }

        $data = $request->validate([
            'due_date' => ['required', 'date', 'after:'.$transaction->start_date->toDateString()],
            'fee' => ['required', 'integer', 'min:0'],
        ]);

        $principal = $transaction->principal;
        $oldDue = $transaction->due_date;
        $newDue = Carbon::parse($data['due_date']);
        $fee = (int) $data['fee'];
        $percent = $principal > 0 ? (int) round($fee / $principal * 100) : 0;
        $currentPeriodStart = $oldDue->copy()->subDays($transaction->tenor_days);

        $transaction->update([
            'due_date' => $newDue,
            'tenor_days' => max(1, (int) $currentPeriodStart->diffInDays($newDue)),
            'fee' => $fee,
            'fee_percent' => $percent,
        ]);

        // Correct the existing extension record in place; keep its event_date
        // and payment_method so the cash/income stay on the original day.
        $transaction->events()
            ->where('type', 'extended')
            ->latest('id')
            ->first()
            ?->update([
                'title' => 'Diperpanjang s/d '.$newDue->format('d M Y'),
                'note' => 'Biaya titipan '.$this->rupiah($fee).' dibayar.',
                'amount' => $fee,
            ]);

        ActivityLog::record(
            'updated',
            'transaction',
            $transaction->code,
            $transaction->customer->name,
            'Mengedit perpanjangan (s/d '.$newDue->format('Y-m-d').', biaya '.$this->rupiah($fee).')',
        );

        return back()->with('success', "Perpanjangan {$transaction->code} diperbarui.");
    }

    public function remind(Request $request, Transaction $transaction): RedirectResponse
    {
        $data = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $phone = $transaction->customer->phone;

        if (blank($phone)) {
            return back()->with('error', 'Pelanggan belum memiliki nomor WhatsApp.');
        }

        if (! app(Fonnte::class)->send($phone, $data['message'])) {
            return back()->with('error', 'Pengingat gagal dikirim. Periksa koneksi atau pengaturan WhatsApp.');
        }

        $transaction->events()->create([
            'type' => 'reminder',
            'event_date' => now(),
            'title' => 'Pengingat WhatsApp dikirim',
            'by' => $request->user()?->name,
        ]);

        ActivityLog::record(
            'updated',
            'transaction',
            $transaction->code,
            $transaction->customer->name,
            'Mengirim pengingat WhatsApp',
        );

        return back()->with('success', "Pengingat terkirim ke {$transaction->customer->name}.");
    }

    /**
     * Send the transaction's nota to the customer's WhatsApp. Tries to attach
     * the PDF file; if that fails, falls back to sending a link.
     */
    public function sendNota(Request $request, Transaction $transaction): RedirectResponse
    {
        $data = $request->validate([
            'message' => ['nullable', 'string', 'max:2000'],
        ]);

        if (blank($transaction->customer->phone)) {
            return back()->with('error', 'Pelanggan belum memiliki nomor WhatsApp.');
        }

        if (! app(Fonnte::class)->isConfigured()) {
            return back()->with('error', 'WhatsApp belum dikonfigurasi. Hubungi admin untuk mengatur token Fonnte.');
        }

        $result = $this->deliverNota($transaction, $data['message'] ?? null, $request->user()?->name);

        if (! $result['sent']) {
            return back()->with('error', 'Nota gagal dikirim. Periksa koneksi atau pengaturan WhatsApp.');
        }

        return back()->with('success', "Link nota terkirim ke {$transaction->customer->name}.");
    }

    /**
     * Send the customer a short public link to their nota over WhatsApp and
     * record an event on success. The link opens the nota PDF in the browser.
     *
     * @return array{sent: bool}
     */
    private function deliverNota(Transaction $transaction, ?string $message, ?string $by): array
    {
        $link = route('nota.public', ['token' => $transaction->shareToken()]);

        $text = filled($message)
            ? rtrim($message)."\n\nNota: {$link}"
            : $this->buildNotaMessage($transaction, $link);

        $sent = app(Fonnte::class)->send($transaction->customer->phone, $text);

        if ($sent) {
            $transaction->events()->create([
                'type' => 'nota_sent',
                'event_date' => now(),
                'title' => 'Nota dikirim ke WhatsApp (link)',
                'by' => $by,
            ]);

            ActivityLog::record(
                'updated',
                'transaction',
                $transaction->code,
                $transaction->customer->name,
                'Mengirim nota ke WhatsApp (link)',
            );
        }

        return ['sent' => $sent];
    }

    /** Default WhatsApp message body when handing a nota to the customer. */
    private function buildNotaMessage(Transaction $transaction, string $link): string
    {
        return implode("\n", [
            "Halo {$transaction->customer->name},",
            '',
            'Berikut nota gadai Anda dari Gulam Cell.',
            '',
            "No. Nota: {$transaction->code}",
            "Barang: {$transaction->device_name}",
            'Jatuh tempo: '.$transaction->due_date->format('d-m-Y'),
            '',
            "Buka & simpan nota: {$link}",
            '',
            'Mohon simpan nota ini untuk penebusan atau perpanjangan. Terima kasih.',
        ]);
    }

    public function markNotRedeemed(Request $request, Transaction $transaction): RedirectResponse
    {
        if (! in_array($transaction->status, ['AKTIF', 'PERPANJANG'], true)) {
            return back()->with('error', 'Transaksi ini tidak bisa ditandai tidak diambil.');
        }

        $transaction->update(['status' => 'TIDAK_DIAMBIL']);

        $transaction->events()->create([
            'type' => 'flagged',
            'event_date' => now(),
            'title' => 'Ditandai tidak diambil',
            'by' => $request->user()?->name,
        ]);

        ActivityLog::record(
            'updated',
            'transaction',
            $transaction->code,
            $transaction->customer->name,
            'Menandai barang tidak diambil',
        );

        return back()->with('success', "Transaksi {$transaction->code} ditandai tidak diambil.");
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

    public function revertLelang(Request $request, Transaction $transaction): RedirectResponse
    {
        if ($transaction->status !== 'LELANG') {
            return back()->with('error', 'Transaksi ini tidak sedang dalam status lelang.');
        }

        if ($transaction->sold_at !== null || $transaction->sale_value !== null) {
            return back()->with('error', 'Barang sudah terjual, lelang tidak bisa dibatalkan.');
        }

        $transaction->update(['status' => 'AKTIF']);

        $transaction->events()->create([
            'type' => 'auctioned',
            'event_date' => now(),
            'title' => 'Dibatalkan dari lelang',
            'by' => $request->user()?->name,
        ]);

        ActivityLog::record(
            'updated',
            'transaction',
            $transaction->code,
            $transaction->customer->name,
            'Membatalkan lelang',
            null,
            true,
        );

        return back()->with('success', "Transaksi {$transaction->code} dikembalikan dari lelang.");
    }

    public function recordSale(Request $request, Transaction $transaction): RedirectResponse
    {
        if ($transaction->status !== 'LELANG') {
            return back()->with('error', 'Hanya barang lelang yang bisa dicatat penjualannya.');
        }

        $data = $request->validate([
            'sale_value' => ['required', 'integer', 'min:0'],
            'wallet_id' => ['nullable', 'integer', 'exists:wallets,id'],
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
            'payment_method' => 'cash',
            'wallet_id' => $this->resolveWallet($data['wallet_id'] ?? null),
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

    /**
     * Whether a fee was cut by more than the owner's allowed share. The limit
     * lives in settings (percent of the original fee); 0 turns the check off.
     * Management is trusted, so only a petugas can trip it.
     */
    private function exceedsDiscountLimit(int $feeBefore, int $feeAfter): bool
    {
        $limit = (int) Setting::get('max_discount_percent', Transaction::MAX_DISCOUNT_PERCENT);

        if ($limit <= 0 || $feeBefore <= 0 || $feeAfter >= $feeBefore) {
            return false;
        }

        if (request()->user()?->isManagement()) {
            return false;
        }

        $cutPercent = ($feeBefore - $feeAfter) / $feeBefore * 100;

        return $cutPercent > $limit;
    }

    private function rupiah(int $amount): string
    {
        return 'Rp '.number_format($amount, 0, ',', '.');
    }

    /**
     * Resolve which cash pocket a movement belongs to: the chosen active wallet,
     * or the default pocket when none/an invalid one is given.
     */
    private function resolveWallet(?int $walletId): ?int
    {
        if ($walletId !== null && Wallet::query()->active()->whereKey($walletId)->exists()) {
            return $walletId;
        }

        return Wallet::defaultId();
    }

    /**
     * Resolve a disbursement's funding: a single pocket, or a split across
     * several. A split of two or more pockets is stored on the event; one (or
     * none) collapses to a single wallet_id.
     *
     * @param  array<int, array{wallet_id?: mixed, amount?: mixed}>|null  $split
     * @return array{wallet_id: int|null, wallet_split: array<int, array{wallet_id: int, amount: int}>|null}
     */
    private function resolveFunding(?array $split, ?int $walletId): array
    {
        $rows = collect($split ?? [])
            ->map(fn ($row): array => [
                'wallet_id' => $this->resolveWallet((int) ($row['wallet_id'] ?? 0)),
                'amount' => (int) ($row['amount'] ?? 0),
            ])
            ->filter(fn (array $row): bool => $row['wallet_id'] !== null && $row['amount'] > 0)
            ->values();

        if ($rows->count() >= 2) {
            return ['wallet_id' => $rows->first()['wallet_id'], 'wallet_split' => $rows->all()];
        }

        if ($rows->count() === 1) {
            return ['wallet_id' => $rows->first()['wallet_id'], 'wallet_split' => null];
        }

        return ['wallet_id' => $this->resolveWallet($walletId), 'wallet_split' => null];
    }

    /**
     * Normalise the phone-lock fields: no value is kept when the type is "none".
     *
     * @param  array<string, mixed>  $data
     * @return array{device_lock_type: string, device_lock_value: string|null}
     */
    private function deviceLock(array $data): array
    {
        $type = $data['device_lock_type'] ?? 'none';

        return [
            'device_lock_type' => $type,
            'device_lock_value' => $type === 'none' ? null : ($data['device_lock_value'] ?? null),
        ];
    }

    /**
     * Device columns normalised for the chosen item type, so fields that do not
     * apply (e.g. IMEI on a motor) are never persisted from a switched form.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function deviceAttributes(array $data): array
    {
        $type = $data['device_type'] ?? 'hp';
        $hasSpecs = in_array($type, ['hp', 'laptop'], true); // ram/storage/serial/lock
        $isHp = $type === 'hp';
        $isMotor = $type === 'motor';
        $lock = $this->deviceLock($data);

        return [
            'device_type' => $type,
            'device_name' => $data['device_name'],
            'device_ram' => $hasSpecs ? ($data['device_ram'] ?? null) : null,
            'device_storage' => $hasSpecs ? ($data['device_storage'] ?? null) : null,
            'device_serial' => $hasSpecs ? ($data['device_serial'] ?? null) : null,
            'imei_1' => $isHp ? ($data['imei_1'] ?? null) : null,
            'imei_2' => $isHp ? ($data['imei_2'] ?? null) : null,
            'device_lock_type' => $hasSpecs ? $lock['device_lock_type'] : 'none',
            'device_lock_value' => $hasSpecs ? $lock['device_lock_value'] : null,
            'plat_nomor' => $isMotor ? ($data['plat_nomor'] ?? null) : null,
            'no_rangka' => $isMotor ? ($data['no_rangka'] ?? null) : null,
            'no_mesin' => $isMotor ? ($data['no_mesin'] ?? null) : null,
            'warna' => $isMotor ? ($data['warna'] ?? null) : null,
            'tahun' => $isMotor ? ($data['tahun'] ?? null) : null,
        ];
    }

    /**
     * WhatsApp the Owner when a new transaction is above the approval threshold
     * and awaiting sign-off before funds are released.
     */
    private function notifyOwnerNeedsApproval(
        Transaction $transaction,
        Customer $customer,
        int $principal,
        int $threshold,
        string $clerk,
        ?Store $store,
    ): void {
        $lines = [
            '🔔 *Perlu Persetujuan Pencairan*',
            '',
            "Nota: {$transaction->code}",
            "Pelanggan: {$customer->name}",
            "Barang: {$transaction->device_name}",
            'Dana titipan: '.$this->rupiah($principal),
            'Ambang batas: '.$this->rupiah($threshold),
            "Petugas: {$clerk}",
        ];

        if ($store) {
            $lines[] = "Toko: {$store->name}";
        }

        $lines[] = '';
        $lines[] = 'Cek & setujui: '.route('transaksi.show', $transaction);

        app(Fonnte::class)->send(
            config('services.fonnte.owner_wa'),
            implode("\n", $lines),
        );
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
        $racks = Rak::sortNaturally(
            Rak::query()
                ->active()
                ->when($storeId !== null, fn ($query) => $query->where('store_id', $storeId))
                ->withCount(['transactions as held_count' => fn ($query) => $query->held()])
                ->get()
        );

        // Suggest the emptiest rack that still has room, so phones spread out
        // instead of piling onto whichever rack the clerk happens to remember.
        $suggested = $racks
            ->filter(fn (Rak $rak): bool => $rak->capacity === null || $rak->held_count < $rak->capacity)
            ->sortBy('held_count')
            ->first();

        return $racks->map(fn (Rak $rak): array => [
            'id' => $rak->id,
            'name' => $rak->name,
            'count' => (int) $rak->held_count,
            'capacity' => $rak->capacity,
            'recommended' => $suggested !== null && $rak->id === $suggested->id,
        ])->all();
    }

    /**
     * Customers with their transactions eager-loaded (newest first), so the
     * form can show an existing customer's pawn history inline.
     *
     * @return Collection<int, Customer>
     */
    private function customersWithHistory(): Collection
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
        $principal = (int) $data['principal'];

        $days = match ($data['tenor_choice']) {
            '15' => 15,
            '30' => 30,
            default => (int) $data['custom_days'],
        };

        // Custom fee can be entered as a nominal rupiah amount; the percent is
        // then derived from it. The fixed tenors stay percent-based.
        if ($data['tenor_choice'] === 'custom' && ($data['fee_mode'] ?? 'percent') === 'nominal') {
            $fee = (int) ($data['custom_fee'] ?? 0);
            $percent = $principal > 0 ? (int) round($fee / $principal * 100) : 0;

            return [
                'principal' => $principal,
                'days' => $days,
                'percent' => $percent,
                'fee' => $fee,
            ];
        }

        $percent = match ($data['tenor_choice']) {
            '15' => 10,
            '30' => 15,
            default => (int) $data['custom_percent'],
        };

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
