<?php

namespace Database\Seeders;

use App\Models\ActivityLog;
use App\Models\Customer;
use App\Models\Transaction;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class GadaiSeeder extends Seeder
{
    /**
     * Port of the design-phase mock dataset into the database.
     */
    public function run(): void
    {
        foreach ($this->transactions() as $row) {
            $customer = Customer::firstOrCreate(
                ['phone' => $row['phone']],
                [
                    'code' => Customer::nextCode(),
                    'name' => $row['name'],
                    'address' => $row['address'],
                    'id_number' => $row['idNumber'],
                    'join_date' => $row['startDate'],
                ],
            );

            $transaction = $customer->transactions()->create([
                'code' => Transaction::nextCode(null, Carbon::parse($row['startDate'])),
                'device_owner' => $row['deviceOwner'] ?? $row['name'],
                'device_name' => $row['device'],
                'device_ram' => $row['ram'],
                'device_storage' => $row['storage'],
                'device_serial' => $row['serial'],
                'kelengkapan' => $row['kelengkapan'],
                'principal' => $row['principal'],
                'tenor_days' => $row['tenorDays'],
                'fee_percent' => $row['feePercent'],
                'fee' => $row['fee'],
                'start_date' => $row['startDate'],
                'due_date' => $row['dueDate'],
                'status' => $row['status'],
                'clerk' => $row['clerk'],
                'notes' => $row['notes'] ?? null,
                'extensions' => $row['extensions'] ?? 0,
            ]);

            foreach ($row['history'] as $event) {
                $transaction->events()->create([
                    'type' => $event['type'],
                    'event_date' => $event['date'],
                    'title' => $event['title'],
                    'note' => $event['note'] ?? null,
                    'by' => $event['by'] ?? null,
                    'amount' => $event['amount'] ?? null,
                ]);
            }

            $log = ActivityLog::create([
                'user_id' => null,
                'actor' => $row['clerk'],
                'action' => 'created',
                'subject_type' => 'transaction',
                'subject_code' => $transaction->code,
                'subject_label' => $row['name'],
                'description' => 'Membuat transaksi',
                'changes' => null,
            ]);
            $log->forceFill([
                'created_at' => $row['startDate'],
                'updated_at' => $row['startDate'],
            ])->saveQuietly();
        }

        foreach ($this->extraCustomers() as $c) {
            Customer::firstOrCreate(['phone' => $c['phone']], [
                'code' => Customer::nextCode(),
                'name' => $c['name'],
                'address' => $c['address'],
                'id_number' => $c['idNumber'],
                'notes' => $c['notes'] ?? null,
                'join_date' => $c['joinDate'],
            ]);
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function transactions(): array
    {
        return [
            [
                'status' => 'AKTIF',
                'name' => 'Budi Santoso', 'phone' => '0812-3344-5566',
                'address' => 'Jl. Serayu No. 12, Tanah Merah', 'idNumber' => '3509xxxxxxxx0007',
                'deviceOwner' => 'Budi Santoso', 'device' => 'iPhone 13 Pro',
                'ram' => '6 GB', 'storage' => '256 GB', 'serial' => '356789102345678',
                'kelengkapan' => 'HP + Box + Charger', 'principal' => 3_500_000,
                'tenorDays' => 15, 'feePercent' => 10, 'fee' => 350_000,
                'startDate' => '2026-07-14', 'dueDate' => '2026-07-24', 'clerk' => 'Rina',
                'notes' => 'Layar mulus, garansi resmi masih aktif.', 'extensions' => 0,
                'history' => [
                    ['type' => 'created', 'date' => '2026-07-14', 'title' => 'Gadai masuk', 'by' => 'Rina', 'amount' => 3_500_000],
                ],
            ],
            [
                'status' => 'AKTIF',
                'name' => 'Siti Rahmawati', 'phone' => '0857-9911-2233',
                'address' => 'Jl. Kapuas No. 4, Tanah Merah', 'idNumber' => '3509xxxxxxxx0142',
                'device' => 'Samsung Galaxy S22', 'ram' => '8 GB', 'storage' => '128 GB',
                'serial' => '351122903344551', 'kelengkapan' => 'HP + Charger',
                'principal' => 2_000_000, 'tenorDays' => 15, 'feePercent' => 10, 'fee' => 200_000,
                'startDate' => '2026-07-04', 'dueDate' => '2026-07-19', 'clerk' => 'Dedi', 'extensions' => 0,
                'history' => [
                    ['type' => 'created', 'date' => '2026-07-04', 'title' => 'Gadai masuk', 'by' => 'Dedi', 'amount' => 2_000_000],
                    ['type' => 'reminder', 'date' => '2026-07-17', 'title' => 'Pengingat WhatsApp terkirim', 'note' => 'H-2 jatuh tempo'],
                ],
            ],
            [
                'status' => 'AKTIF',
                'name' => 'Ahmad Fauzi', 'phone' => '0813-2200-8899',
                'address' => 'Jl. Barito No. 21, Tanah Merah', 'idNumber' => '3509xxxxxxxx0311',
                'deviceOwner' => 'Nur Aisyah', 'device' => 'Xiaomi Redmi Note 12',
                'ram' => '8 GB', 'storage' => '256 GB', 'serial' => '359001772211003',
                'kelengkapan' => 'HP saja', 'principal' => 1_200_000,
                'tenorDays' => 30, 'feePercent' => 15, 'fee' => 180_000,
                'startDate' => '2026-06-21', 'dueDate' => '2026-07-21', 'clerk' => 'Rina',
                'notes' => 'Device milik saudara pelanggan (Nur Aisyah).', 'extensions' => 0,
                'history' => [
                    ['type' => 'created', 'date' => '2026-06-21', 'title' => 'Gadai masuk', 'by' => 'Rina', 'amount' => 1_200_000],
                ],
            ],
            [
                'status' => 'AKTIF',
                'name' => 'Dewi Lestari', 'phone' => '0821-5566-1010',
                'address' => 'Jl. Musi No. 8, Tanah Merah', 'idNumber' => '3509xxxxxxxx0455',
                'device' => 'Oppo Reno 8', 'ram' => '8 GB', 'storage' => '256 GB',
                'serial' => '358812004455667', 'kelengkapan' => 'HP + Box',
                'principal' => 1_800_000, 'tenorDays' => 15, 'feePercent' => 10, 'fee' => 180_000,
                'startDate' => '2026-07-15', 'dueDate' => '2026-07-30', 'clerk' => 'Dedi', 'extensions' => 0,
                'history' => [
                    ['type' => 'created', 'date' => '2026-07-15', 'title' => 'Gadai masuk', 'by' => 'Dedi', 'amount' => 1_800_000],
                ],
            ],
            [
                'status' => 'PERPANJANG',
                'name' => 'Rizky Pratama', 'phone' => '0812-7788-3421',
                'address' => 'Jl. Serayu No. 40, Tanah Merah', 'idNumber' => '3509xxxxxxxx0512',
                'device' => 'iPhone 12', 'ram' => '4 GB', 'storage' => '128 GB',
                'serial' => '353998112233440', 'kelengkapan' => 'HP + Box + Charger',
                'principal' => 2_500_000, 'tenorDays' => 15, 'feePercent' => 10, 'fee' => 250_000,
                'startDate' => '2026-06-27', 'dueDate' => '2026-07-27', 'clerk' => 'Rina',
                'notes' => 'Diperpanjang 1x, bayar biaya titipan.', 'extensions' => 1,
                'history' => [
                    ['type' => 'created', 'date' => '2026-06-27', 'title' => 'Gadai masuk', 'by' => 'Rina', 'amount' => 2_500_000],
                    ['type' => 'extended', 'date' => '2026-07-12', 'title' => 'Perpanjangan 1', 'note' => 'Jatuh tempo baru: 27 Jul 2026', 'by' => 'Rina', 'amount' => 250_000],
                ],
            ],
            [
                'status' => 'PERPANJANG',
                'name' => 'Maya Sari', 'phone' => '0895-3300-7788',
                'address' => 'Jl. Bengawan No. 3, Tanah Merah', 'idNumber' => '3509xxxxxxxx0623',
                'device' => 'Vivo V27', 'ram' => '8 GB', 'storage' => '256 GB',
                'serial' => '357220998877665', 'kelengkapan' => 'HP + Charger',
                'principal' => 1_600_000, 'tenorDays' => 15, 'feePercent' => 10, 'fee' => 160_000,
                'startDate' => '2026-06-20', 'dueDate' => '2026-07-20', 'clerk' => 'Dedi', 'extensions' => 2,
                'history' => [
                    ['type' => 'created', 'date' => '2026-06-20', 'title' => 'Gadai masuk', 'by' => 'Dedi', 'amount' => 1_600_000],
                    ['type' => 'extended', 'date' => '2026-07-05', 'title' => 'Perpanjangan 1', 'by' => 'Dedi', 'amount' => 160_000],
                    ['type' => 'extended', 'date' => '2026-07-15', 'title' => 'Perpanjangan 2', 'note' => 'Jatuh tempo baru: 20 Jul 2026', 'by' => 'Rina', 'amount' => 160_000],
                ],
            ],
            [
                'status' => 'TIDAK_DIAMBIL',
                'name' => 'Eko Prasetyo', 'phone' => '0819-4455-2200',
                'address' => 'Jl. Serayu No. 77, Tanah Merah', 'idNumber' => '3509xxxxxxxx0744',
                'device' => 'Realme 11 Pro', 'ram' => '8 GB', 'storage' => '128 GB',
                'serial' => '354001223344556', 'kelengkapan' => 'HP + Box',
                'principal' => 1_400_000, 'tenorDays' => 15, 'feePercent' => 10, 'fee' => 140_000,
                'startDate' => '2026-06-30', 'dueDate' => '2026-07-15', 'clerk' => 'Rina',
                'notes' => 'Lewat tempo, belum ada kabar. Sudah dihubungi 2x.', 'extensions' => 0,
                'history' => [
                    ['type' => 'created', 'date' => '2026-06-30', 'title' => 'Gadai masuk', 'by' => 'Rina', 'amount' => 1_400_000],
                    ['type' => 'reminder', 'date' => '2026-07-13', 'title' => 'Pengingat WhatsApp terkirim', 'note' => 'H-2 jatuh tempo'],
                    ['type' => 'flagged', 'date' => '2026-07-16', 'title' => 'Ditandai Tidak Diambil', 'note' => 'Lewat tenggat, belum ada informasi.', 'by' => 'Sistem'],
                ],
            ],
            [
                'status' => 'TIDAK_DIAMBIL',
                'name' => 'Indah Permata', 'phone' => '0856-1212-9090',
                'address' => 'Jl. Kapuas No. 19, Tanah Merah', 'idNumber' => '3509xxxxxxxx0890',
                'device' => 'Samsung Galaxy A54', 'ram' => '8 GB', 'storage' => '256 GB',
                'serial' => '352667889900112', 'kelengkapan' => 'HP saja',
                'principal' => 1_700_000, 'tenorDays' => 15, 'feePercent' => 10, 'fee' => 170_000,
                'startDate' => '2026-07-02', 'dueDate' => '2026-07-17', 'clerk' => 'Dedi', 'extensions' => 0,
                'history' => [
                    ['type' => 'created', 'date' => '2026-07-02', 'title' => 'Gadai masuk', 'by' => 'Dedi', 'amount' => 1_700_000],
                    ['type' => 'flagged', 'date' => '2026-07-18', 'title' => 'Ditandai Tidak Diambil', 'by' => 'Sistem'],
                ],
            ],
            [
                'status' => 'LELANG',
                'name' => 'Hendra Gunawan', 'phone' => '0812-9090-1122',
                'address' => 'Jl. Barito No. 5, Tanah Merah', 'idNumber' => '3509xxxxxxxx0934',
                'device' => 'Poco X5', 'ram' => '8 GB', 'storage' => '256 GB',
                'serial' => '351889002233447', 'kelengkapan' => 'HP + Charger',
                'principal' => 900_000, 'tenorDays' => 15, 'feePercent' => 10, 'fee' => 90_000,
                'startDate' => '2026-06-20', 'dueDate' => '2026-07-05', 'clerk' => 'Rina',
                'notes' => 'Lewat 1 minggu tanpa kabar. Masuk daftar lelang.', 'extensions' => 0,
                'history' => [
                    ['type' => 'created', 'date' => '2026-06-20', 'title' => 'Gadai masuk', 'by' => 'Rina', 'amount' => 900_000],
                    ['type' => 'flagged', 'date' => '2026-07-06', 'title' => 'Ditandai Tidak Diambil', 'by' => 'Sistem'],
                    ['type' => 'auctioned', 'date' => '2026-07-12', 'title' => 'Masuk daftar Lelang', 'note' => '1 minggu lewat jatuh tempo, tanpa informasi.', 'by' => 'Sistem'],
                ],
            ],
            [
                'status' => 'DIAMBIL',
                'name' => 'Nur Aisyah', 'phone' => '0838-7766-5544',
                'address' => 'Jl. Musi No. 30, Tanah Merah', 'idNumber' => '3509xxxxxxxx1055',
                'device' => 'iPhone 14', 'ram' => '6 GB', 'storage' => '128 GB',
                'serial' => '357001998812345', 'kelengkapan' => 'HP + Box + Charger',
                'principal' => 4_000_000, 'tenorDays' => 15, 'feePercent' => 10, 'fee' => 400_000,
                'startDate' => '2026-06-25', 'dueDate' => '2026-07-10', 'clerk' => 'Dedi', 'extensions' => 0,
                'history' => [
                    ['type' => 'created', 'date' => '2026-06-25', 'title' => 'Gadai masuk', 'by' => 'Dedi', 'amount' => 4_000_000],
                    ['type' => 'redeemed', 'date' => '2026-07-08', 'title' => 'Ditebus & diambil', 'note' => 'Bayar dana titipan + biaya titipan.', 'by' => 'Dedi', 'amount' => 4_400_000],
                ],
            ],
            [
                'status' => 'DIAMBIL',
                'name' => 'Agus Salim', 'phone' => '0852-3311-4499',
                'address' => 'Jl. Bengawan No. 14, Tanah Merah', 'idNumber' => '3509xxxxxxxx1187',
                'device' => 'Infinix Note 30', 'ram' => '8 GB', 'storage' => '256 GB',
                'serial' => '358774100022119', 'kelengkapan' => 'HP + Box',
                'principal' => 1_100_000, 'tenorDays' => 15, 'feePercent' => 10, 'fee' => 110_000,
                'startDate' => '2026-06-30', 'dueDate' => '2026-07-15', 'clerk' => 'Rina', 'extensions' => 0,
                'history' => [
                    ['type' => 'created', 'date' => '2026-06-30', 'title' => 'Gadai masuk', 'by' => 'Rina', 'amount' => 1_100_000],
                    ['type' => 'redeemed', 'date' => '2026-07-14', 'title' => 'Ditebus & diambil', 'by' => 'Rina', 'amount' => 1_210_000],
                ],
            ],
            [
                'status' => 'AKTIF',
                'name' => 'Lia Kusuma', 'phone' => '0813-6677-8080',
                'address' => 'Jl. Serayu No. 58, Tanah Merah', 'idNumber' => '3509xxxxxxxx1290',
                'device' => 'iPhone 13', 'ram' => '4 GB', 'storage' => '256 GB',
                'serial' => '356112889900443', 'kelengkapan' => 'HP + Box',
                'principal' => 3_000_000, 'tenorDays' => 20, 'feePercent' => 12, 'fee' => 360_000,
                'startDate' => '2026-07-02', 'dueDate' => '2026-07-22', 'clerk' => 'Rina',
                'notes' => 'Tenor & persentase custom.', 'extensions' => 0,
                'history' => [
                    ['type' => 'created', 'date' => '2026-07-02', 'title' => 'Gadai masuk', 'by' => 'Rina', 'amount' => 3_000_000],
                ],
            ],
            [
                'status' => 'AKTIF',
                'name' => 'Fajar Nugroho', 'phone' => '0878-2233-6611',
                'address' => 'Jl. Kapuas No. 61, Tanah Merah', 'idNumber' => '3509xxxxxxxx1345',
                'device' => 'Samsung Galaxy S21 FE', 'ram' => '8 GB', 'storage' => '128 GB',
                'serial' => '351009887766554', 'kelengkapan' => 'HP + Charger',
                'principal' => 2_200_000, 'tenorDays' => 15, 'feePercent' => 10, 'fee' => 220_000,
                'startDate' => '2026-07-05', 'dueDate' => '2026-07-20', 'clerk' => 'Dedi', 'extensions' => 0,
                'history' => [
                    ['type' => 'created', 'date' => '2026-07-05', 'title' => 'Gadai masuk', 'by' => 'Dedi', 'amount' => 2_200_000],
                    ['type' => 'reminder', 'date' => '2026-07-18', 'title' => 'Pengingat WhatsApp terkirim', 'note' => 'H-2 jatuh tempo'],
                ],
            ],
            [
                'status' => 'DIAMBIL',
                'name' => 'Rina Wati', 'phone' => '0812-4545-6767',
                'address' => 'Jl. Barito No. 33, Tanah Merah', 'idNumber' => '3509xxxxxxxx1467',
                'device' => 'Oppo A78', 'ram' => '8 GB', 'storage' => '256 GB',
                'serial' => '359776001122338', 'kelengkapan' => 'HP saja',
                'principal' => 950_000, 'tenorDays' => 15, 'feePercent' => 10, 'fee' => 95_000,
                'startDate' => '2026-06-28', 'dueDate' => '2026-07-13', 'clerk' => 'Dedi', 'extensions' => 0,
                'history' => [
                    ['type' => 'created', 'date' => '2026-06-28', 'title' => 'Gadai masuk', 'by' => 'Dedi', 'amount' => 950_000],
                    ['type' => 'redeemed', 'date' => '2026-07-11', 'title' => 'Ditebus & diambil', 'by' => 'Dedi', 'amount' => 1_045_000],
                ],
            ],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function extraCustomers(): array
    {
        return [
            [
                'name' => 'Wahyu Hidayat', 'phone' => '0812-1100-2233',
                'address' => 'Jl. Musi No. 45, Tanah Merah', 'idNumber' => '3509xxxxxxxx1620',
                'joinDate' => '2026-05-18', 'notes' => 'Pelanggan lama, biasanya gadai musiman.',
            ],
            [
                'name' => 'Sri Wahyuni', 'phone' => '0857-2244-8080',
                'address' => 'Jl. Serayu No. 90, Tanah Merah', 'idNumber' => '3509xxxxxxxx1733',
                'joinDate' => '2026-06-02',
            ],
        ];
    }
}
