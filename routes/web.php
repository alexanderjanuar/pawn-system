<?php

use App\Http\Controllers\AktivitasController;
use App\Http\Controllers\CekStatusController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\GadaiController;
use App\Http\Controllers\JatuhTempoController;
use App\Http\Controllers\LaporanController;
use App\Http\Controllers\PelangganController;
use App\Http\Controllers\PengaturanController;
use App\Http\Controllers\PenggunaController;
use App\Http\Controllers\PiutangController;
use App\Http\Controllers\RakController;
use App\Http\Controllers\TokoController;
use App\Http\Controllers\TransaksiController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return redirect()->route(auth()->check() ? 'dashboard' : 'login');
})->name('home');

Route::middleware(['auth', 'active-store'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // Ganti toko aktif (hanya owner & admin; petugas terkunci ke cabangnya)
    Route::post('toko/switch', [TokoController::class, 'switch'])
        ->middleware('role:owner,admin')
        ->name('toko.switch');

    // Kelola toko (hanya owner & admin)
    Route::middleware('role:owner,admin')->group(function () {
        Route::get('pengaturan/toko', [TokoController::class, 'index'])->name('pengaturan.toko');
        Route::post('pengaturan/toko', [TokoController::class, 'store'])->name('pengaturan.toko.store');
        Route::put('pengaturan/toko/{store}', [TokoController::class, 'update'])->name('pengaturan.toko.update');
        Route::delete('pengaturan/toko/{store}', [TokoController::class, 'destroy'])->name('pengaturan.toko.destroy');
    });

    // Transaksi
    Route::get('transaksi', [TransaksiController::class, 'index'])->name('transaksi.index');
    Route::get('gadai/baru', [GadaiController::class, 'create'])->name('gadai.create');
    Route::get('gadai/cek-imei', [GadaiController::class, 'cekImei'])->name('gadai.cek-imei');
    Route::post('gadai', [GadaiController::class, 'store'])->name('gadai.store');
    Route::get('transaksi/{transaction}/edit', [GadaiController::class, 'edit'])->name('transaksi.edit');
    Route::put('transaksi/{transaction}', [GadaiController::class, 'update'])->name('transaksi.update');
    Route::delete('transaksi/{transaction}', [GadaiController::class, 'destroy'])->name('transaksi.destroy');

    // Persetujuan pencairan (hanya owner & admin)
    Route::middleware('role:owner,admin')->group(function () {
        Route::post('transaksi/{transaction}/approve', [GadaiController::class, 'approve'])->name('transaksi.approve');
        Route::post('transaksi/{transaction}/reject', [GadaiController::class, 'reject'])->name('transaksi.reject');
    });

    // Tebus (redeem & take) + Perpanjang (extend)
    Route::post('transaksi/{transaction}/tebus', [GadaiController::class, 'redeem'])->name('transaksi.redeem');
    Route::post('transaksi/{transaction}/perpanjang', [GadaiController::class, 'extend'])->name('transaksi.extend');

    // Lelang
    Route::post('transaksi/{transaction}/lelang', [GadaiController::class, 'lelang'])->name('transaksi.lelang');
    Route::post('transaksi/{transaction}/sale', [GadaiController::class, 'recordSale'])->name('transaksi.sale');
    Route::get('transaksi/{transaction}', [TransaksiController::class, 'show'])->name('transaksi.show');
    Route::get('transaksi/{transaction}/nota', [TransaksiController::class, 'nota'])->name('transaksi.nota');

    // Pelanggan
    Route::get('pelanggan', [PelangganController::class, 'index'])->name('pelanggan.index');
    Route::post('pelanggan', [PelangganController::class, 'store'])->name('pelanggan.store');
    Route::put('pelanggan/{customer}', [PelangganController::class, 'update'])->name('pelanggan.update');
    Route::put('pelanggan/{customer}/blacklist', [PelangganController::class, 'blacklist'])->name('pelanggan.blacklist');
    Route::delete('pelanggan/{customer}/blacklist', [PelangganController::class, 'unblacklist'])->name('pelanggan.unblacklist');
    Route::delete('pelanggan/{customer}', [PelangganController::class, 'destroy'])->name('pelanggan.destroy');
    Route::get('pelanggan/{customer}', [PelangganController::class, 'show'])->name('pelanggan.show');

    // Operasional
    Route::get('jatuh-tempo', [JatuhTempoController::class, 'index'])->name('jatuh-tempo');

    // Rak (rak fisik penyimpanan HP) — dilihat semua peran, dikelola owner/admin
    Route::get('rak', [RakController::class, 'index'])->name('rak.index');
    Route::middleware('role:owner,admin')->group(function () {
        Route::post('rak', [RakController::class, 'store'])->name('rak.store');
        Route::put('rak/{rak}', [RakController::class, 'update'])->name('rak.update');
        Route::delete('rak/{rak}', [RakController::class, 'destroy'])->name('rak.destroy');
    });

    // Piutang HP (jual/ambil HP secara kredit) — operasional; hapus khusus owner/admin
    Route::get('piutang', [PiutangController::class, 'index'])->name('piutang.index');
    Route::post('piutang', [PiutangController::class, 'store'])->name('piutang.store');
    Route::get('piutang/{piutang}', [PiutangController::class, 'show'])->name('piutang.show');
    Route::put('piutang/{piutang}', [PiutangController::class, 'update'])->name('piutang.update');
    Route::put('piutang/{piutang}/termin', [PiutangController::class, 'setTermin'])->name('piutang.termin');
    Route::post('piutang/{piutang}/bayar', [PiutangController::class, 'storePayment'])->name('piutang.bayar');
    Route::middleware('role:owner,admin')->group(function () {
        Route::delete('piutang/{piutang}', [PiutangController::class, 'destroy'])->name('piutang.destroy');
        Route::delete('piutang/{piutang}/bayar/{payment}', [PiutangController::class, 'destroyPayment'])->name('piutang.bayar.destroy');
    });

    // Laporan & audit (hanya owner & admin — petugas tidak melihat data laporan/keuangan/aktivitas)
    Route::middleware('role:owner,admin')->group(function () {
        Route::get('aktivitas', [AktivitasController::class, 'index'])->name('aktivitas');
        Route::get('laporan', [LaporanController::class, 'index'])->name('laporan');
        Route::get('laporan/lelang', [LaporanController::class, 'lelang'])->name('laporan.lelang');
        Route::get('laporan/export', [LaporanController::class, 'export'])->name('laporan.export');
        Route::get('laporan/cetak', [LaporanController::class, 'cetak'])->name('laporan.cetak');
    });

    // Pemilik (hanya owner & admin)
    Route::middleware('role:owner,admin')->group(function () {
        Route::get('pengaturan/biaya', [PengaturanController::class, 'biaya'])->name('pengaturan.biaya');
        Route::put('pengaturan/biaya', [PengaturanController::class, 'updateBiaya'])->name('pengaturan.biaya.update');
        Route::get('pengaturan/petugas', [PengaturanController::class, 'petugas'])->name('pengaturan.petugas');
        Route::get('pengaturan/petugas/by-name/{name}', [PengaturanController::class, 'showPetugasByName'])->name('pengaturan.petugas.by-name');
        Route::get('pengaturan/petugas/{clerk}', [PengaturanController::class, 'showPetugas'])->name('pengaturan.petugas.show');
        Route::post('pengaturan/petugas', [PengaturanController::class, 'storePetugas'])->name('pengaturan.petugas.store');
        Route::put('pengaturan/petugas/{clerk}', [PengaturanController::class, 'updatePetugas'])->name('pengaturan.petugas.update');
        Route::delete('pengaturan/petugas/{clerk}', [PengaturanController::class, 'destroyPetugas'])->name('pengaturan.petugas.destroy');

        // Kelola akun login (pengguna)
        Route::get('pengaturan/akun', [PenggunaController::class, 'index'])->name('pengaturan.akun');
        Route::post('pengaturan/akun', [PenggunaController::class, 'store'])->name('pengaturan.akun.store');
        Route::put('pengaturan/akun/{user}', [PenggunaController::class, 'update'])->name('pengaturan.akun.update');
        Route::put('pengaturan/akun/{user}/password', [PenggunaController::class, 'password'])->name('pengaturan.akun.password');
        Route::delete('pengaturan/akun/{user}', [PenggunaController::class, 'destroy'])->name('pengaturan.akun.destroy');
    });
});

// Halaman publik: pelanggan cek status gadai miliknya sendiri
Route::get('cek-status', [CekStatusController::class, 'index'])->name('cek-status');

require __DIR__.'/settings.php';
