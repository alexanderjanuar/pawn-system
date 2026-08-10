/**
 * Domain types for the Gulam Cell II pawn-management system.
 * Design-preview shapes; the backend build will mirror these.
 */

export type GadaiStatus =
    'AKTIF' | 'PERPANJANG' | 'DIAMBIL' | 'TIDAK_DIAMBIL' | 'LELANG';

/** Free text now (HP, motor, laptop, dll) — was a fixed HP-only enum. */
export type Kelengkapan = string;

/** Contact snapshot stored on each transaction. */
export type CustomerContact = {
    name: string;
    phone: string;
    address: string;
    idNumber: string; // No. KTP
};

/** Compact pawn-history row shown for an existing customer on the form. */
export type CustomerHistoryEntry = {
    id: string; // kode transaksi, e.g. GCG-20260720-0001
    device: string;
    principal: number;
    status: GadaiStatus;
    date: string; // ISO tanggal masuk
    detailUrl: string;
};

/** First-class customer record (own "database"). */
export type Customer = CustomerContact & {
    id: string; // kode pelanggan, e.g. PLG-001
    joinDate: string; // ISO, bergabung sejak
    notes?: string;
    blacklisted: boolean;
    blacklistReason: string | null;
    /** Prior pawns, newest first. Only present on the transaction form. */
    transactions?: CustomerHistoryEntry[];
};

export type DeviceLockType = 'none' | 'pin' | 'password' | 'pattern';

/** Jenis barang yang digadaikan. HP tetap yang utama. */
export type DeviceType = 'hp' | 'motor' | 'laptop';

export type Device = {
    type: DeviceType;
    name: string; // Nama HP / Merk-Tipe motor atau laptop
    ram: string;
    storage: string;
    serial: string; // nomor seri
    imei1: string | null;
    imei2: string | null;
    // Khusus motor
    platNomor: string | null;
    noRangka: string | null;
    noMesin: string | null;
    warna: string | null;
    tahun: string | null;
    lockType: DeviceLockType; // cara buka HP / laptop
    lockValue: string | null; // PIN / kata sandi / urutan pola "1-2-3"
    kelengkapan: Kelengkapan;
};

export type TimelineType =
    'created' | 'reminder' | 'extended' | 'redeemed' | 'auctioned' | 'flagged';

export type TimelineEvent = {
    type: TimelineType;
    date: string; // ISO date
    title: string;
    note?: string;
    by?: string; // petugas
    amount?: number;
};

/** A business milestone or an audit edit. */
export type HistoryKind = TimelineType | 'updated';

/** One time-stamped entry in a transaction's Riwayat (merged log). */
export type HistoryEntry = {
    kind: HistoryKind;
    date: string; // YYYY-MM-DD
    time: string; // HH.mm
    title: string;
    note?: string | null;
    by?: string | null;
    amount?: number | null;
    changes: ActivityChange[];
};

export type ActivityAction = 'created' | 'updated' | 'deleted';

/** One field-level change captured in an audit entry. */
export type ActivityChange = {
    field: string;
    from: string;
    to: string;
};

/** Audit-log entry: who did what, when. */
export type Activity = {
    id: number;
    actor: string;
    action: ActivityAction;
    subjectType:
        | 'transaction'
        | 'customer'
        | 'petugas'
        | 'user'
        | 'store'
        | 'rak'
        | 'piutang';
    subjectCode: string | null;
    subjectLabel: string | null;
    description: string;
    changes: ActivityChange[];
    date: string; // YYYY-MM-DD
    time: string; // HH.mm
};

export type ApprovalStatus = 'approved' | 'pending' | 'rejected';

export type Transaction = {
    id: string; // nomor nota, e.g. GCG-20260729-0001
    detailUrl: string; // URL absolut ke halaman detail (QR petugas)
    statusUrl: string; // URL absolut ke Cek Status prefilled (QR pelanggan di nota)
    status: GadaiStatus;
    approvalStatus: ApprovalStatus;
    approvedBy?: string | null;
    approvedAt?: string | null;
    customer: CustomerContact;
    deviceOwner: string; // pemilik device (bisa berbeda dari pelanggan)
    device: Device;
    principal: number; // dana titipan
    tenorDays: number;
    feePercent: number;
    fee: number; // biaya titipan
    saleValue?: number | null; // nilai jual lelang
    soldAt?: string | null; // tanggal terjual lelang
    startDate: string; // ISO tanggal masuk
    notaStartDate: string; // ISO tanggal masuk untuk nota (awal periode perpanjangan)
    dueDate: string; // ISO
    createdAt?: string; // ISO timestamp pembuatan transaksi
    clerk: string; // petugas yang menangani
    rakId?: number | null; // rak fisik tempat HP disimpan
    rak?: string | null; // nama rak
    notes?: string | null;
    extensions: number; // berapa kali diperpanjang
    history: TimelineEvent[];
    customerCode?: string; // kode pelanggan terkait
    photos?: { url: string; label: string | null }[]; // foto barang + label opsional
    ktp?: string | null; // URL scan KTP
};
