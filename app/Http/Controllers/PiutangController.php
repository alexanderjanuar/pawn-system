<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Clerk;
use App\Models\Piutang;
use App\Models\PiutangPayment;
use App\Models\Store;
use App\Services\Fonnte;
use App\Support\ActiveStore;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PiutangController extends Controller
{
    public function index(): Response
    {
        $piutangs = Piutang::query()
            ->forActiveStore()
            ->with(['store', 'termins'])
            ->withSum('payments as paid', 'amount')
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->get();

        $today = now()->startOfDay();

        $rows = $piutangs->map(function (Piutang $p) use ($today): array {
            $paid = (int) ($p->paid ?? 0);
            $financed = max(0, $p->price - $p->down_payment);

            // The first termin not yet covered by payments (applied in order) is
            // what the debtor owes next, and it is late once its date has passed.
            $late = false;
            $nextDue = null;

            if ($p->status !== 'lunas') {
                $unapplied = $paid;

                foreach ($p->termins as $t) {
                    $applied = min($t->amount, max(0, $unapplied));
                    $unapplied -= $applied;

                    if ($applied < $t->amount) {
                        $late = $t->due_date->lt($today);
                        $nextDue = [
                            'seq' => $t->seq,
                            'amount' => $t->amount - $applied,
                            'dueDate' => $t->due_date->format('Y-m-d'),
                        ];
                        break;
                    }
                }
            }

            return [
                'id' => $p->id,
                'code' => $p->code,
                'debtorName' => $p->debtor_name,
                'debtorPhone' => $p->debtor_phone,
                'deviceName' => $p->device_name,
                'price' => $p->price,
                'downPayment' => $p->down_payment,
                'financed' => $financed,
                'paid' => $paid,
                'remaining' => max(0, $financed - $paid),
                'status' => $p->status,
                'terminCount' => $p->termins->count(),
                'late' => $late,
                'nextDue' => $nextDue,
                'date' => $p->date->format('Y-m-d'),
                'storeName' => $p->store?->name,
                'detailUrl' => route('piutang.show', $p),
            ];
        });

        return Inertia::render('piutang/index', [
            'piutangs' => $rows->values(),
            'summary' => [
                'berjalan' => $rows->where('status', 'berjalan')->count(),
                'outstanding' => (int) $rows->sum('remaining'),
                'collected' => (int) $rows->sum('paid'),
            ],
            'petugasList' => $this->petugasOptions(),
            'canManage' => request()->user()->isManagement(),
        ]);
    }

    public function show(Piutang $piutang): Response
    {
        $piutang->load([
            'store',
            'termins',
            'payments' => fn ($q) => $q->orderByDesc('paid_at')->orderByDesc('id'),
        ]);
        $paid = $piutang->paid();

        return Inertia::render('piutang/show', [
            'piutang' => [
                'id' => $piutang->id,
                'code' => $piutang->code,
                'debtorName' => $piutang->debtor_name,
                'debtorPhone' => $piutang->debtor_phone,
                'deviceName' => $piutang->device_name,
                'price' => $piutang->price,
                'downPayment' => $piutang->down_payment,
                'financed' => $piutang->financed(),
                'paid' => $paid,
                'remaining' => $piutang->remaining(),
                'status' => $piutang->status,
                'date' => $piutang->date->format('Y-m-d'),
                'clerk' => $piutang->clerk,
                'notes' => $piutang->notes,
                'storeName' => $piutang->store?->name,
                'termins' => $piutang->terminSchedule(),
                'payments' => $piutang->payments->map(fn (PiutangPayment $pay): array => [
                    'id' => $pay->id,
                    'amount' => $pay->amount,
                    'paidAt' => $pay->paid_at->format('Y-m-d'),
                    'by' => $pay->by,
                    'note' => $pay->note,
                ]),
            ],
            'canManage' => request()->user()->isManagement(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $storeId = $this->resolveStore();

        if ($storeId === false) {
            return back()->with('error', 'Pilih satu toko dari pemilih toko di atas untuk mencatat piutang.');
        }

        $data = $request->validate([
            'debtor_name' => ['required', 'string', 'max:120'],
            'debtor_phone' => ['nullable', 'string', 'max:30'],
            'device_name' => ['required', 'string', 'max:120'],
            'price' => ['required', 'integer', 'min:1'],
            'down_payment' => ['nullable', 'integer', 'min:0', 'lte:price'],
            'date' => ['required', 'date'],
            'clerk' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'termin_count' => ['nullable', 'integer', 'min:2', 'max:24'],
        ]);

        $store = $storeId ? Store::find($storeId) : null;

        $piutang = Piutang::create([
            'store_id' => $storeId,
            'code' => Piutang::nextCode($store, now()),
            'debtor_name' => $data['debtor_name'],
            'debtor_phone' => blank($data['debtor_phone'] ?? null) ? null : $data['debtor_phone'],
            'device_name' => $data['device_name'],
            'price' => $data['price'],
            'down_payment' => $data['down_payment'] ?? 0,
            'date' => $data['date'],
            'status' => 'berjalan',
            'clerk' => ($data['clerk'] ?? '') ?: ($request->user()?->name ?? 'Petugas'),
            'notes' => $data['notes'] ?? null,
        ]);

        if (! empty($data['termin_count'])) {
            $piutang->generateTermins($data['termin_count'], $piutang->date);
        }

        ActivityLog::record('created', 'piutang', $piutang->code, $piutang->debtor_name, 'Mencatat piutang HP');

        return redirect()
            ->route('piutang.show', $piutang)
            ->with('success', "Piutang {$piutang->code} dicatat.");
    }

    public function update(Request $request, Piutang $piutang): RedirectResponse
    {
        $data = $request->validate([
            'debtor_name' => ['required', 'string', 'max:120'],
            'debtor_phone' => ['nullable', 'string', 'max:30'],
            'device_name' => ['required', 'string', 'max:120'],
            'price' => ['required', 'integer', 'min:1'],
            'down_payment' => ['nullable', 'integer', 'min:0', 'lte:price'],
            'date' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $data['down_payment'] ??= 0;
        $data['debtor_phone'] = blank($data['debtor_phone'] ?? null) ? null : $data['debtor_phone'];
        $piutang->update($data);

        // Keep the termin schedule in step with an edited total/date.
        if ($piutang->termins()->exists()) {
            $piutang->generateTermins($piutang->termins()->count(), $piutang->date);
        }

        $piutang->syncStatus();

        ActivityLog::record('updated', 'piutang', $piutang->code, $piutang->debtor_name, 'Memperbarui piutang');

        return back()->with('success', "Piutang {$piutang->code} diperbarui.");
    }

    public function setTermin(Request $request, Piutang $piutang): RedirectResponse
    {
        $data = $request->validate([
            'termin_count' => ['nullable', 'integer', 'min:0', 'max:24'],
        ]);

        $count = (int) ($data['termin_count'] ?? 0);
        $piutang->generateTermins($count, $piutang->date);

        ActivityLog::record(
            'updated',
            'piutang',
            $piutang->code,
            $piutang->debtor_name,
            $count >= 2 ? "Mengatur {$count}x termin" : 'Menghapus jadwal termin',
        );

        return back()->with('success', $count >= 2
            ? "Jadwal {$count}x termin dibuat."
            : 'Jadwal termin dihapus.');
    }

    /**
     * Send one WhatsApp instalment reminder to the debtor, straight from the
     * piutang list so the clerk does not have to open each record first.
     */
    public function remind(Request $request, Piutang $piutang): RedirectResponse
    {
        $data = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
        ]);

        if (blank($piutang->debtor_phone)) {
            return back()->with('error', 'Peminjam belum memiliki nomor WhatsApp.');
        }

        $fonnte = app(Fonnte::class);

        if (! $fonnte->send($piutang->debtor_phone, $data['message'])) {
            return back()->with('error', $fonnte->lastError()
                ?? 'Pengingat gagal dikirim. Periksa koneksi atau pengaturan WhatsApp.');
        }

        ActivityLog::record(
            'updated',
            'piutang',
            $piutang->code,
            $piutang->debtor_name,
            'Mengirim pengingat WhatsApp',
        );

        return back()->with('success', "Pengingat terkirim ke {$piutang->debtor_name}.");
    }

    public function destroy(Piutang $piutang): RedirectResponse
    {
        $code = $piutang->code;
        $name = $piutang->debtor_name;
        $piutang->delete();

        ActivityLog::record('deleted', 'piutang', $code, $name, 'Menghapus piutang');

        return redirect()
            ->route('piutang.index')
            ->with('success', "Piutang {$code} dihapus.");
    }

    public function storePayment(Request $request, Piutang $piutang): RedirectResponse
    {
        $remaining = $piutang->remaining();

        if ($remaining <= 0) {
            return back()->with('error', 'Piutang ini sudah lunas.');
        }

        $data = $request->validate([
            'amount' => ['required', 'integer', 'min:1', "max:{$remaining}"],
            'paid_at' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $piutang->payments()->create([
            'amount' => $data['amount'],
            'paid_at' => $data['paid_at'],
            'by' => $request->user()?->name,
            'note' => $data['note'] ?? null,
        ]);

        $piutang->refresh()->syncStatus();
        $lunas = $piutang->isLunas();

        ActivityLog::record(
            'updated',
            'piutang',
            $piutang->code,
            $piutang->debtor_name,
            'Pembayaran '.$this->rupiah($data['amount']).($lunas ? ' — lunas' : ''),
        );

        return back()->with('success', $lunas
            ? "Piutang {$piutang->code} lunas."
            : 'Pembayaran dicatat.');
    }

    public function destroyPayment(Piutang $piutang, PiutangPayment $payment): RedirectResponse
    {
        if ($payment->piutang_id !== $piutang->id) {
            return back()->with('error', 'Pembayaran tidak ditemukan.');
        }

        $payment->delete();
        $piutang->refresh()->syncStatus();

        ActivityLog::record('updated', 'piutang', $piutang->code, $piutang->debtor_name, 'Menghapus pembayaran');

        return back()->with('success', 'Pembayaran dihapus.');
    }

    private function rupiah(int $amount): string
    {
        return 'Rp '.number_format($amount, 0, ',', '.');
    }

    /**
     * Active petugas names for the active store, as form suggestions.
     *
     * @return array<int, string>
     */
    private function petugasOptions(): array
    {
        $storeId = app(ActiveStore::class)->id();

        return Clerk::query()
            ->active()
            ->when($storeId !== null, fn ($q) => $q->where('store_id', $storeId))
            ->orderBy('name')
            ->pluck('name')
            ->all();
    }

    /**
     * The store a new piutang belongs to (active store). False when a management
     * user is viewing "all stores" and must pick one first; null in single-shop.
     */
    private function resolveStore(): int|false|null
    {
        $activeId = app(ActiveStore::class)->id();

        if ($activeId !== null) {
            return $activeId;
        }

        return Store::query()->exists() ? false : null;
    }
}
