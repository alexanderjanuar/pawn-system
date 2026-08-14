@php
    $rp = fn ($n) => 'Rp ' . number_format((int) $n, 0, ',', '.');
    $kasSistem = $saldo + $net;
    $cols = 6;
@endphp
<html>
<head>
    <meta charset="UTF-8">
</head>
<body>
<table border="0" cellspacing="0" cellpadding="6"
       style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:12px;color:#1e293b">
    <colgroup>
        <col style="width:130px"><col style="width:150px"><col style="width:180px">
        <col style="width:110px"><col style="width:90px"><col style="width:130px">
    </colgroup>

    {{-- Title --}}
    <tr>
        <td colspan="{{ $cols }}"
            style="font-size:18px;font-weight:bold;color:#15803d;padding-bottom:2px">
            KAS HARIAN — {{ $shop }}
        </td>
    </tr>
    <tr>
        <td colspan="{{ $cols }}" style="color:#64748b;padding-top:0">{{ $periodLabel }}</td>
    </tr>
    <tr><td colspan="{{ $cols }}" style="height:8px"></td></tr>

    {{-- Uang Masuk --}}
    <tr>
        <td colspan="{{ $cols }}"
            style="background:#15803d;color:#f8fafc;font-weight:bold;letter-spacing:0.5px">
            UANG MASUK
        </td>
    </tr>
    <tr style="background:#f1f5f9;font-weight:bold">
        <td style="border:1px solid #e2e8f0">Waktu</td>
        <td style="border:1px solid #e2e8f0">Kode</td>
        <td style="border:1px solid #e2e8f0">Pelanggan</td>
        <td style="border:1px solid #e2e8f0">Jenis</td>
        <td style="border:1px solid #e2e8f0">Metode</td>
        <td style="border:1px solid #e2e8f0;text-align:right">Jumlah</td>
    </tr>
    @forelse ($masuk as $e)
        <tr>
            <td style="border:1px solid #e2e8f0">{{ $e['date'] }}{{ $e['time'] ? ' ' . $e['time'] : '' }}</td>
            <td style="border:1px solid #e2e8f0">{{ $e['code'] }}</td>
            <td style="border:1px solid #e2e8f0">{{ $e['customer'] }}</td>
            <td style="border:1px solid #e2e8f0">{{ $kindLabels[$e['kind']] ?? $e['kind'] }}</td>
            <td style="border:1px solid #e2e8f0">{{ $e['method'] ? ($methodLabels[$e['method']] ?? $e['method']) : '—' }}</td>
            <td style="border:1px solid #e2e8f0;text-align:right;color:#15803d">{{ $rp($e['amount']) }}</td>
        </tr>
    @empty
        <tr>
            <td colspan="{{ $cols }}" style="border:1px solid #e2e8f0;color:#94a3b8">Tidak ada</td>
        </tr>
    @endforelse
    <tr style="font-weight:bold;background:#f8fafc">
        <td colspan="5" style="border:1px solid #e2e8f0">Total Masuk</td>
        <td style="border:1px solid #e2e8f0;text-align:right;color:#15803d">{{ $rp($in['total']) }}</td>
    </tr>
    <tr>
        <td colspan="{{ $cols }}" style="color:#64748b;font-size:11px">
            Tunai {{ $rp($in['cash']) }} &nbsp;·&nbsp; Transfer {{ $rp($in['transfer']) }}
        </td>
    </tr>
    <tr><td colspan="{{ $cols }}" style="height:8px"></td></tr>

    {{-- Uang Keluar --}}
    <tr>
        <td colspan="{{ $cols }}"
            style="background:#c2410c;color:#f8fafc;font-weight:bold;letter-spacing:0.5px">
            UANG KELUAR
        </td>
    </tr>
    <tr style="background:#f1f5f9;font-weight:bold">
        <td style="border:1px solid #e2e8f0">Waktu</td>
        <td style="border:1px solid #e2e8f0">Kode</td>
        <td style="border:1px solid #e2e8f0">Pelanggan</td>
        <td colspan="2" style="border:1px solid #e2e8f0">Jenis</td>
        <td style="border:1px solid #e2e8f0;text-align:right">Jumlah</td>
    </tr>
    @forelse ($keluar as $e)
        <tr>
            <td style="border:1px solid #e2e8f0">{{ $e['date'] }}{{ $e['time'] ? ' ' . $e['time'] : '' }}</td>
            <td style="border:1px solid #e2e8f0">{{ $e['code'] }}</td>
            <td style="border:1px solid #e2e8f0">{{ $e['customer'] }}</td>
            <td colspan="2" style="border:1px solid #e2e8f0">{{ $kindLabels[$e['kind']] ?? $e['kind'] }}</td>
            <td style="border:1px solid #e2e8f0;text-align:right;color:#c2410c">{{ $rp($e['amount']) }}</td>
        </tr>
    @empty
        <tr>
            <td colspan="{{ $cols }}" style="border:1px solid #e2e8f0;color:#94a3b8">Tidak ada</td>
        </tr>
    @endforelse
    <tr style="font-weight:bold;background:#f8fafc">
        <td colspan="5" style="border:1px solid #e2e8f0">Total Keluar</td>
        <td style="border:1px solid #e2e8f0;text-align:right;color:#c2410c">{{ $rp($out['total']) }}</td>
    </tr>
    <tr><td colspan="{{ $cols }}" style="height:12px"></td></tr>

    {{-- Rekonsiliasi --}}
    <tr>
        <td colspan="{{ $cols }}"
            style="background:#334155;color:#f8fafc;font-weight:bold;letter-spacing:0.5px">
            REKONSILIASI KAS
        </td>
    </tr>
    <tr>
        <td colspan="4" style="border:1px solid #e2e8f0">Saldo Awal</td>
        <td colspan="2" style="border:1px solid #e2e8f0;text-align:right">{{ $rp($saldo) }}</td>
    </tr>
    <tr>
        <td colspan="4" style="border:1px solid #e2e8f0">Uang Masuk (+)</td>
        <td colspan="2" style="border:1px solid #e2e8f0;text-align:right;color:#15803d">{{ $rp($in['total']) }}</td>
    </tr>
    <tr>
        <td colspan="4" style="border:1px solid #e2e8f0">Uang Keluar (−)</td>
        <td colspan="2" style="border:1px solid #e2e8f0;text-align:right;color:#c2410c">{{ $rp($out['total']) }}</td>
    </tr>
    <tr style="font-weight:bold;background:#f1f5f9">
        <td colspan="4" style="border:1px solid #cbd5e1">Kas Sistem (seharusnya di laci)</td>
        <td colspan="2" style="border:1px solid #cbd5e1;text-align:right">{{ $rp($kasSistem) }}</td>
    </tr>
    <tr>
        <td colspan="4" style="border:1px solid #e2e8f0">Kas Fisik (hasil hitung)</td>
        <td colspan="2" style="border:1px solid #e2e8f0;background:#fffbeb"></td>
    </tr>
    <tr>
        <td colspan="4" style="border:1px solid #e2e8f0">Selisih (Fisik − Sistem)</td>
        <td colspan="2" style="border:1px solid #e2e8f0;background:#fffbeb"></td>
    </tr>
    <tr><td colspan="{{ $cols }}" style="height:12px"></td></tr>
    <tr>
        <td colspan="{{ $cols }}" style="color:#94a3b8;font-size:11px">
            Isi "Kas Fisik" dari hasil hitung uang di laci, lalu bandingkan dengan "Kas Sistem". Selisih idealnya Rp 0.
        </td>
    </tr>
</table>
</body>
</html>
