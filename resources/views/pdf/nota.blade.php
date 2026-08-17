@php
    $ketentuan = [
        'Segera perpanjang jika sampai dengan tanggal keluar / jatuh tempo tetapi barang anda belum ditebus, karena segala hal yang terjadi atas barang setelah tanggal tersebut adalah diluar tanggung jawab kami (kecuali ada perjanjian tertentu).',
        'Pembayaran titipan barang / perpanjang / cicilan dana, bisa via transfer Bank jika berhalangan datang ke Counter.',
        'Mohon nota jangan sampai hilang dan harus dibawa saat penebusan barang / perpanjangan.',
        'Harus segera konfirmasi / beritahukan kepada kami jika anda mengganti nomor handphone.',
        'Barang yang dimasukkan tidak boleh memiliki masalah kepemilikan / masalah hukum / bukan kreditan.',
        'Kami tidak bertanggung jawab atas segala tuntutan dari pihak manapun, jika ternyata barang bermasalah kepemilikan / hukum karena pemalsuan data, persyaratan atau kebohongan yang dilakukan oleh pelanggan saat memasukkan barangnya.',
        'Kami berhak menuntut pengambilan dana kepada pelanggan (Perihal: Poin No. 5 dan No. 6) karena hal-hal yang diluar kuasa dan sepengetahuan kami.',
        'Pelanggan dan Gulam Cell II sepakat atas ketentuan dan perjanjian dengan tanpa paksaan dari pihak manapun.',
    ];
@endphp
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @page { margin: 18px 22px; }
        * { box-sizing: border-box; }
        body {
            font-family: DejaVu Sans, sans-serif;
            color: #0f172a;
            font-size: 11px;
            line-height: 1.35;
            margin: 0;
        }
        .box { border: 2px solid #0f172a; }
        table { border-collapse: collapse; width: 100%; }
        .field td {
            border: 1px solid #0f172a;
            padding: 5px 8px;
            vertical-align: top;
        }
        .field .lbl {
            width: 34%;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 9.5px;
        }
        .dot {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            text-align: center;
            line-height: 20px;
            font-size: 10px;
            font-weight: bold;
        }
        ol.terms { margin: 8px 0 0; padding-left: 16px; font-size: 9px; line-height: 1.3; }
        ol.terms li { margin-bottom: 2px; }
    </style>
</head>
<body>
    {{-- Header --}}
    <table class="box" style="text-align:center;">
        <tr><td style="padding:6px 10px 2px;">
            <div style="font-size:22px; font-weight:bold; letter-spacing:0.5px;">GULAM CELL II</div>
            <div style="font-size:10px; font-weight:bold; margin-top:2px;">
                Jl. Serayu Tanah Merah No. 57 / Hp : 0852 2387 7117
            </div>
        </td></tr>
    </table>

    {{-- No nota + judul + cek status --}}
    <table style="margin-top:8px;">
        <tr>
            <td style="width:62%; padding-right:8px; vertical-align:top;">
                <div class="box" style="padding:6px 10px; font-weight:bold; font-size:12px;">
                    NO NOTA. <span style="letter-spacing:0.5px;">{{ $n['code'] }}</span>
                </div>
                <div class="box" style="padding:8px 10px; margin-top:6px; text-align:center; font-weight:bold; letter-spacing:1px;">
                    NOTA BARANG GADAI
                </div>
            </td>
            <td style="vertical-align:top;">
                <div class="box" style="padding:8px 10px; text-align:center;">
                    <div style="font-weight:bold; text-transform:uppercase; font-size:8px; color:#334155; margin-bottom:3px;">
                        Cek Status Online
                    </div>
                    <div style="font-size:8.5px; word-break:break-all; color:#0f172a;">{{ $n['statusUrl'] }}</div>
                </div>
            </td>
        </tr>
    </table>

    {{-- Pelanggan --}}
    <table class="field box" style="margin-top:8px;">
        <tr><td class="lbl">Tanggal Masuk</td><td>{{ $n['notaStartDate'] }}</td></tr>
        <tr><td class="lbl">Nama Pelanggan</td><td>{{ $n['customerName'] }}</td></tr>
        <tr><td class="lbl">No. HP Pelanggan</td><td>{{ $n['customerPhone'] }}</td></tr>
        <tr><td class="lbl">Nama Pemilik</td><td>{{ $n['deviceOwner'] }}</td></tr>
        <tr><td class="lbl">Alamat</td><td>{{ $n['customerAddress'] }}</td></tr>
    </table>

    {{-- Barang --}}
    <table class="field box" style="margin-top:8px;">
        <tr><td class="lbl">Nama &amp; Tipe Barang</td><td>{{ $n['deviceName'] }}</td></tr>
        <tr><td class="lbl">Kelengkapan</td><td>{{ $n['kelengkapan'] }}</td></tr>
        @if ($n['deviceType'] === 'motor')
            <tr><td class="lbl">Plat Nomor</td><td>{{ $n['platNomor'] }}</td></tr>
            <tr><td class="lbl">No. Rangka</td><td>{{ $n['noRangka'] }}</td></tr>
        @else
            <tr><td class="lbl">Nomor Seri</td><td>{{ $n['serial'] }}</td></tr>
        @endif
    </table>

    {{-- Dana --}}
    <table class="field box" style="margin-top:8px;">
        <tr><td class="lbl">Dana Titipan</td><td>{{ $n['principal'] }}</td></tr>
        <tr><td class="lbl">Biaya Penitipan Barang</td><td>{{ $n['fee'] }}</td></tr>
        <tr><td class="lbl">Tanggal Keluar</td><td>{{ $n['dueDate'] }}</td></tr>
    </table>

    {{-- Kunci & Catatan --}}
    @if ($n['hasLock'] || filled($n['notes']))
        <table class="field box" style="margin-top:8px;">
            @if ($n['hasLock'])
                <tr>
                    <td class="lbl">{{ $n['lockLabel'] }}</td>
                    <td>
                        @if ($n['lockType'] === 'pattern')
                            <table style="width:auto;">
                                <tr>
                                    <td style="padding:0 8px 0 0; vertical-align:middle;">
                                        <table style="width:auto; border-collapse:separate; border-spacing:3px;">
                                            @foreach (array_chunk($n['lockGrid'], 3) as $row)
                                                <tr>
                                                    @foreach ($row as $order)
                                                        <td style="width:24px; height:24px; text-align:center; vertical-align:middle;">
                                                            @if ($order !== null)
                                                                <div class="dot" style="background:#0f172a; color:#f8fafc;">{{ $order }}</div>
                                                            @else
                                                                <div class="dot" style="background:#cbd5e1;"></div>
                                                            @endif
                                                        </td>
                                                    @endforeach
                                                </tr>
                                            @endforeach
                                        </table>
                                    </td>
                                    <td style="vertical-align:middle; font-weight:bold;">{{ $n['lockSequence'] }}</td>
                                </tr>
                            </table>
                        @else
                            <span style="font-family:DejaVu Sans Mono, monospace; font-weight:bold;">{{ $n['lockValue'] }}</span>
                        @endif
                    </td>
                </tr>
            @endif
            @if (filled($n['notes']))
                <tr><td class="lbl">Catatan</td><td>{{ $n['notes'] }}</td></tr>
            @endif
        </table>
    @endif

    {{-- Ketentuan --}}
    <ol class="terms">
        @foreach ($ketentuan as $item)
            <li>{{ $item }}</li>
        @endforeach
    </ol>

    {{-- Tanda tangan --}}
    <table style="margin-top:22px;">
        <tr>
            <td style="width:50%; padding-right:16px;">
                <div style="font-weight:bold;">Pelanggan</div>
                <div style="margin-top:42px; border-bottom:1px solid #0f172a; color:#334155; font-size:10px; padding-bottom:1px;">
                    {{ $n['customerName'] }}
                </div>
            </td>
            <td style="width:50%; padding-left:16px;">
                <div style="font-weight:bold;">Petugas,</div>
                <div style="margin-top:42px; border-bottom:1px solid #0f172a; color:#334155; font-size:10px; padding-bottom:1px;">
                    {{ $n['clerk'] }}
                </div>
            </td>
        </tr>
    </table>
</body>
</html>
