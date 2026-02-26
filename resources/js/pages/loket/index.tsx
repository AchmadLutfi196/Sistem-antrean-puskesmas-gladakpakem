import { Head, router, usePage } from '@inertiajs/react';
import { cloneElement, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import {
    Megaphone, SkipForward, UserPlus, Search, ChevronDown,
    CheckCircle2, Clock, Users, Star, AlertCircle,
    Shield, CreditCard, Stethoscope, FileText, ClipboardCheck,
    Save, Phone, MapPin, User, Heart, Briefcase, Droplets,
    Hash, Home, Building, LogOut
} from 'lucide-react';

interface QueueItem {
    id: number; queue_number: string; queue_category: string;
    priority_reason: string | null; status: string; poly_name: string | null;
    payment_type: string | null; counter_number: number | null;
}
interface Poly { id: number; name: string; }
interface DoctorOption { id: number; name: string; poly_id: number; poly_name: string | null; }
interface Stats { totalToday: number; waiting: number; served: number; skipped: number; }
interface Patient {
    id: number; medical_record: string; nik: string | null; bpjs_number: string | null;
    name: string; birth_date: string | null; birth_place: string | null; gender: string | null;
    address: string | null; rt_rw: string | null; kelurahan: string | null; kecamatan: string | null;
    kabupaten: string | null; phone: string | null; blood_type: string | null;
    marital_status: string | null; occupation: string | null; allergy: string | null; patient_type: string;
}

export default function LoketPage() {
    const props = usePage().props as any;
    const { queues, currentServing, counterNumber, polyclinics, doctors, stats } = props;
    const flash = props.flash;

    const [tab, setTab] = useState<'baru' | 'lama'>('lama');
    const [selectedQueue, setSelectedQueue] = useState<QueueItem | null>(currentServing);
    const [counterNum, setCounterNum] = useState(counterNumber);
    const [searchRM, setSearchRM] = useState('');
    const [searchNIK, setSearchNIK] = useState('');
    const [searchBPJS, setSearchBPJS] = useState('');
    const [searchName, setSearchName] = useState('');
    const [searchResults, setSearchResults] = useState<Patient[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [formData, setFormData] = useState({
        nik: '', name: '', birth_date: '', birth_place: '', gender: 'L', address: '', rt_rw: '',
        kelurahan: '', kecamatan: '', kabupaten: 'Jember', phone: '', blood_type: '',
        marital_status: '', occupation: '', allergy: '', bpjs_number: '',
    });
    const [polyId, setPolyId] = useState<number>(polyclinics[0]?.id || 0);
    const [doctorId, setDoctorId] = useState<number | null>(null);
    const [consent, setConsent] = useState({ rights: false, obligations: false, service: false, general: false });
    const [bpjsResult, setBpjsResult] = useState<any>(null);
    const [bpjsLoading, setBpjsLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState<{ type: string; msg: string } | null>(null);

    useEffect(() => {
        if (flash?.success) {
            Swal.fire({ icon: 'success', title: 'Berhasil!', text: flash.success, confirmButtonColor: '#0d9488', timer: 3000, timerProgressBar: true });
        }
        if (flash?.error) {
            Swal.fire({ icon: 'error', title: 'Gagal!', text: flash.error, confirmButtonColor: '#0d9488' });
        }
    }, [flash]);

    useEffect(() => {
        const interval = setInterval(() => { router.reload({ only: ['queues', 'currentServing', 'stats'] }); }, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleCallNext = () => router.post('/queue/call-next', { counter_number: counterNum }, { preserveScroll: true });
    const handleSkip = (q: QueueItem) => router.post(`/queue/${q.id}/skip`, {}, { preserveScroll: true });
    const handleSetCounter = (n: number) => { setCounterNum(n); router.post('/loket/set-counter', { counter_number: n }, { preserveScroll: true }); };

    const handleSearch = async () => {
        const params = new URLSearchParams();
        if (searchRM) params.set('medical_record', searchRM);
        if (searchNIK) params.set('nik', searchNIK);
        if (searchBPJS) params.set('bpjs_number', searchBPJS);
        if (searchName) params.set('name', searchName);
        const res = await fetch(`/loket/search-patient?${params.toString()}`);
        const data = await res.json();
        setSearchResults(data.patients || []);
    };

    const handleCheckBPJS = async () => {
        const bpjsNum = tab === 'lama' ? selectedPatient?.bpjs_number : formData.bpjs_number;
        if (!bpjsNum) return;
        setBpjsLoading(true);
        try {
            const res = await fetch('/bpjs/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '' },
                body: JSON.stringify({ bpjs_number: bpjsNum }),
            });
            const data = await res.json();
            setBpjsResult(data.data);
        } catch { setBpjsResult(null); }
        setBpjsLoading(false);
    };

    const handleRegister = () => {
        if (!selectedQueue) return;
        setLoading(true);
        const payload: any = {
            queue_id: selectedQueue.id, patient_type: tab, payment_type: selectedQueue.payment_type || 'umum',
            poly_id: polyId, doctor_id: doctorId, rights_informed: consent.rights,
            obligations_informed: consent.obligations, service_info_given: consent.service, general_consent: consent.general,
        };
        if (tab === 'lama' && selectedPatient) { payload.patient_id = selectedPatient.id; payload.name = selectedPatient.name; }
        else { Object.assign(payload, formData); }
        router.post('/loket/register', payload, {
            preserveScroll: true,
            onSuccess: () => {
                setSelectedPatient(null); setSearchResults([]); setBpjsResult(null);
                setConsent({ rights: false, obligations: false, service: false, general: false });
                setFormData({ nik: '', name: '', birth_date: '', birth_place: '', gender: 'L', address: '', rt_rw: '', kelurahan: '', kecamatan: '', kabupaten: 'Jember', phone: '', blood_type: '', marital_status: '', occupation: '', allergy: '', bpjs_number: '' });
                setLoading(false);
            },
            onError: () => {
                setLoading(false);
                Swal.fire({ icon: 'error', title: 'Gagal!', text: 'Terjadi kesalahan saat mendaftarkan pasien.', confirmButtonColor: '#0d9488' });
            },
        });
    };

    const filteredDoctors = doctors.filter((d: DoctorOption) => d.poly_id === polyId);
    const priorityQueues = queues.filter((q: QueueItem) => q.queue_category === 'prioritas');
    const generalQueues = queues.filter((q: QueueItem) => q.queue_category === 'umum');

    return (
        <>
            <Head title="Loket Pendaftaran" />
            <div className="min-h-screen bg-slate-50 flex">
                {/* LEFT SIDEBAR */}
                <aside className="w-[280px] bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden shadow-sm">
                    <div className="bg-gradient-to-br from-teal-700 to-teal-800 text-white p-3">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="font-bold text-sm flex items-center gap-1.5">
                                <FileText className="w-4 h-4" /> ANTREAN LOKET
                            </h2>
                            <div className="flex items-center gap-1 bg-teal-600/50 rounded-lg px-2 py-1">
                                <span className="text-[10px] text-teal-300">Loket</span>
                                <select value={counterNum} onChange={e => handleSetCounter(Number(e.target.value))} className="bg-transparent text-white text-xs font-bold w-8 text-center outline-none">
                                    {[1,2,3,4,5].map(n => <option key={n} value={n} className="text-black">{n}</option>)}
                                </select>
                            </div>
                        </div>
                        <button onClick={handleCallNext}
                            className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-900 font-bold text-sm py-2.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30">
                            <Megaphone className="w-4 h-4" /> PANGGIL BERIKUTNYA
                        </button>
                    </div>

                    {/* Currently serving */}
                    {currentServing && (
                        <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border-b border-teal-200 p-3">
                            <div className="text-[10px] text-teal-600 font-semibold uppercase tracking-wider flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Sedang Melayani
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                {currentServing.queue_category === 'prioritas' && <Star className="w-4 h-4 text-amber-500" />}
                                <span className="text-xl font-black text-teal-800">{currentServing.queue_number}</span>
                            </div>
                            <div className="flex gap-1.5 mt-2">
                                <button onClick={() => setSelectedQueue(currentServing)} className="text-[10px] bg-teal-600 text-white px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 hover:bg-teal-500 transition-colors">
                                    <UserPlus className="w-3 h-3" /> Daftarkan
                                </button>
                                <button onClick={() => handleSkip(currentServing)} className="text-[10px] bg-red-100 text-red-600 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 hover:bg-red-200 transition-colors">
                                    <SkipForward className="w-3 h-3" /> Skip
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-1.5 p-2 bg-slate-50 border-b">
                        <MiniStat icon={<Clock className="w-3.5 h-3.5 text-yellow-500" />} label="Menunggu" value={stats.waiting} />
                        <MiniStat icon={<CheckCircle2 className="w-3.5 h-3.5 text-green-500" />} label="Terdaftar" value={stats.served} />
                    </div>

                    {/* Queue list */}
                    <div className="flex-1 overflow-y-auto">
                        {priorityQueues.length > 0 && (
                            <div className="p-2">
                                <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                                    <Star className="w-3 h-3" /> Prioritas ({priorityQueues.length})
                                </div>
                                {priorityQueues.map((q: QueueItem) => (
                                    <QueueCard key={q.id} queue={q} selected={selectedQueue?.id === q.id} onSelect={() => setSelectedQueue(q)} />
                                ))}
                            </div>
                        )}
                        {generalQueues.length > 0 && (
                            <div className="p-2">
                                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                                    <Users className="w-3 h-3" /> Umum ({generalQueues.length})
                                </div>
                                {generalQueues.map((q: QueueItem) => (
                                    <QueueCard key={q.id} queue={q} selected={selectedQueue?.id === q.id} onSelect={() => setSelectedQueue(q)} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Logout Button */}
                    <div className="p-2 border-t border-slate-200 bg-slate-50">
                        <button
                            onClick={() => router.post('/logout')}
                            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors active:scale-95"
                        >
                            <LogOut className="w-4 h-4" />
                            Keluar
                        </button>
                    </div>
                </aside>

                {/* MAIN CONTENT */}
                <main className="flex-1 p-5 overflow-y-auto">
                    {/* Notification */}
                    {notification && (
                        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 animate-fadeIn ${
                            notification.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'
                        }`}>
                            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                            {notification.msg}
                        </div>
                    )}

                    {selectedQueue ? (
                        <>
                            {/* Queue Header */}
                            <div className={`rounded-xl p-4 mb-5 flex items-center justify-between border backdrop-blur transition-all ${
                                selectedQueue.queue_category === 'prioritas'
                                    ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'
                                    : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
                            }`}>
                                <div className="flex items-center gap-3">
                                    {selectedQueue.queue_category === 'prioritas' && <Star className="w-6 h-6 text-amber-500" />}
                                    <div>
                                        <div className="text-2xl font-black">{selectedQueue.queue_number}</div>
                                        <div className="text-xs text-slate-500 uppercase">{selectedQueue.queue_category} {selectedQueue.priority_reason ? `— ${selectedQueue.priority_reason}` : ''}</div>
                                    </div>
                                </div>
                                <div className="flex gap-2 text-xs">
                                    <span className={`px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${selectedQueue.payment_type === 'bpjs' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>
                                        {selectedQueue.payment_type === 'bpjs' ? <Shield className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                                        {selectedQueue.payment_type?.toUpperCase()}
                                    </span>
                                    <StatusBadge status={selectedQueue.status} />
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex gap-1 mb-5 bg-slate-100 rounded-xl p-1">
                                <TabButton active={tab === 'lama'} onClick={() => setTab('lama')} icon={<Search className="w-3.5 h-3.5" />} label="Pasien Lama" />
                                <TabButton active={tab === 'baru'} onClick={() => setTab('baru')} icon={<UserPlus className="w-3.5 h-3.5" />} label="Pasien Baru" />
                            </div>

                            {/* Pasien Lama */}
                            {tab === 'lama' && (
                                <div className="space-y-4">
                                    <Section icon={<Search className="w-4 h-4" />} title="Cari Pasien">
                                        <div className="grid grid-cols-2 gap-2">
                                            <FI icon={<Hash />} label="No. RM" value={searchRM} onChange={setSearchRM} placeholder="RM-000001" />
                                            <FI icon={<FileText />} label="NIK" value={searchNIK} onChange={setSearchNIK} placeholder="350912..." />
                                            <FI icon={<Shield />} label="No. BPJS" value={searchBPJS} onChange={setSearchBPJS} placeholder="000123..." />
                                            <FI icon={<User />} label="Nama" value={searchName} onChange={setSearchName} placeholder="Nama..." />
                                        </div>
                                        <button onClick={handleSearch} className="mt-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                                            <Search className="w-4 h-4" /> Cari
                                        </button>
                                        {searchResults.length > 0 && (
                                            <div className="mt-3 space-y-1">
                                                {searchResults.map(p => (
                                                    <button key={p.id} onClick={() => setSelectedPatient(p)}
                                                        className={`w-full text-left p-3 rounded-lg text-sm border transition-all ${selectedPatient?.id === p.id ? 'bg-teal-50 border-teal-300 shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center"><User className="w-4 h-4 text-teal-600" /></div>
                                                            <div>
                                                                <span className="font-bold text-teal-700">{p.medical_record}</span> — <span className="font-medium">{p.name}</span>
                                                                <div className="text-[10px] text-slate-400">{p.nik || 'NIK belum ada'}</div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </Section>
                                    {selectedPatient && (
                                        <Section icon={<FileText className="w-4 h-4" />} title="Data Pasien">
                                            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                                                <IR icon={<Hash />} label="No. RM" value={selectedPatient.medical_record} />
                                                <IR icon={<FileText />} label="NIK" value={selectedPatient.nik || '-'} />
                                                <IR icon={<User />} label="Nama" value={selectedPatient.name} />
                                                <IR icon={<Shield />} label="No. BPJS" value={selectedPatient.bpjs_number || '-'} />
                                                <IR icon={<Clock />} label="Tgl Lahir" value={selectedPatient.birth_date || '-'} />
                                                <IR icon={<User />} label="Gender" value={selectedPatient.gender === 'L' ? 'Laki-laki' : 'Perempuan'} />
                                                <IR icon={<Home />} label="Alamat" value={selectedPatient.address || '-'} />
                                                <IR icon={<Phone />} label="Telepon" value={selectedPatient.phone || '-'} />
                                                <IR icon={<AlertCircle />} label="Alergi" value={selectedPatient.allergy || 'Tidak ada'} />
                                            </div>
                                        </Section>
                                    )}
                                </div>
                            )}

                            {/* Pasien Baru */}
                            {tab === 'baru' && (
                                <Section icon={<UserPlus className="w-4 h-4" />} title="Data Pasien Baru">
                                    <div className="grid grid-cols-2 gap-2">
                                        <FI icon={<FileText />} label="NIK *" value={formData.nik} onChange={v => setFormData({...formData, nik: v})} />
                                        <FI icon={<User />} label="Nama Lengkap *" value={formData.name} onChange={v => setFormData({...formData, name: v})} />
                                        <FI icon={<MapPin />} label="Tempat Lahir" value={formData.birth_place} onChange={v => setFormData({...formData, birth_place: v})} />
                                        <FI icon={<Clock />} label="Tanggal Lahir" value={formData.birth_date} onChange={v => setFormData({...formData, birth_date: v})} type="date" />
                                        <div>
                                            <label className="text-[10px] text-slate-500 font-medium block mb-1 uppercase tracking-wider">Jenis Kelamin</label>
                                            <div className="flex gap-3">
                                                {['L', 'P'].map(g => (
                                                    <label key={g} className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border cursor-pointer transition-all ${formData.gender === g ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                                        <input type="radio" name="gender" value={g} checked={formData.gender === g} onChange={() => setFormData({...formData, gender: g})} className="hidden" />
                                                        <User className="w-3.5 h-3.5" /> {g === 'L' ? 'Laki-laki' : 'Perempuan'}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        <FI icon={<Shield />} label="No. BPJS" value={formData.bpjs_number} onChange={v => setFormData({...formData, bpjs_number: v})} />
                                        <div className="col-span-2"><FI icon={<Home />} label="Alamat" value={formData.address} onChange={v => setFormData({...formData, address: v})} /></div>
                                        <FI icon={<Hash />} label="RT/RW" value={formData.rt_rw} onChange={v => setFormData({...formData, rt_rw: v})} placeholder="003/007" />
                                        <FI icon={<Building />} label="Kelurahan" value={formData.kelurahan} onChange={v => setFormData({...formData, kelurahan: v})} />
                                        <FI icon={<Building />} label="Kecamatan" value={formData.kecamatan} onChange={v => setFormData({...formData, kecamatan: v})} />
                                        <FI icon={<Building />} label="Kabupaten" value={formData.kabupaten} onChange={v => setFormData({...formData, kabupaten: v})} />
                                        <FI icon={<Phone />} label="Telepon" value={formData.phone} onChange={v => setFormData({...formData, phone: v})} />
                                        <FI icon={<Droplets />} label="Gol. Darah" value={formData.blood_type} onChange={v => setFormData({...formData, blood_type: v})} placeholder="A/B/AB/O" />
                                        <FI icon={<Heart />} label="Status Nikah" value={formData.marital_status} onChange={v => setFormData({...formData, marital_status: v})} />
                                        <FI icon={<Briefcase />} label="Pekerjaan" value={formData.occupation} onChange={v => setFormData({...formData, occupation: v})} />
                                        <div className="col-span-2"><FI icon={<AlertCircle />} label="Alergi" value={formData.allergy} onChange={v => setFormData({...formData, allergy: v})} placeholder="Tidak ada" /></div>
                                    </div>
                                </Section>
                            )}

                            {/* BPJS Verification */}
                            {selectedQueue.payment_type === 'bpjs' && (
                                <Section icon={<Shield className="w-4 h-4" />} title="Verifikasi BPJS" className="mt-4">
                                    <div className="flex gap-2 items-end">
                                        <FI icon={<Shield />} label="No. BPJS" value={tab === 'lama' ? (selectedPatient?.bpjs_number || '') : formData.bpjs_number} onChange={() => {}} disabled />
                                        <button onClick={handleCheckBPJS} disabled={bpjsLoading}
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4 py-2.5 rounded-lg disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5 transition-colors shadow-sm">
                                            {bpjsLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Shield className="w-4 h-4" />}
                                            {bpjsLoading ? 'Mengecek...' : 'Cek BPJS'}
                                        </button>
                                    </div>
                                    {bpjsResult && (
                                        <div className={`mt-3 rounded-xl p-4 border ${bpjsResult.aktif ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                                            <div className="flex items-center gap-2 mb-2">
                                                {bpjsResult.aktif ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
                                                <span className={`font-bold text-sm ${bpjsResult.aktif ? 'text-emerald-700' : 'text-red-700'}`}>
                                                    {bpjsResult.aktif ? 'PESERTA AKTIF' : 'PESERTA TIDAK AKTIF'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-1 text-xs">
                                                <IR icon={<User />} label="Nama" value={bpjsResult.nama} />
                                                <IR icon={<Star />} label="Kelas" value={bpjsResult.jnsKelas?.nama || '-'} />
                                            </div>
                                        </div>
                                    )}
                                </Section>
                            )}

                            {/* Mandatory Info */}
                            <Section icon={<ClipboardCheck className="w-4 h-4" />} title="Informasi Wajib" className="mt-4">
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { key: 'rights', label: 'Hak pasien disampaikan' },
                                        { key: 'obligations', label: 'Kewajiban pasien disampaikan' },
                                        { key: 'service', label: 'Info pelayanan diberikan' },
                                        { key: 'general', label: 'Persetujuan umum ditandatangani' },
                                    ].map(item => (
                                        <label key={item.key} className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
                                            (consent as any)[item.key] ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                        }`}>
                                            <input type="checkbox" checked={(consent as any)[item.key]} onChange={e => setConsent({...consent, [item.key]: e.target.checked})} className="hidden" />
                                            <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${(consent as any)[item.key] ? 'bg-teal-600' : 'bg-slate-200'}`}>
                                                {(consent as any)[item.key] && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                            </div>
                                            {item.label}
                                        </label>
                                    ))}
                                </div>
                            </Section>

                            {/* Poli Target */}
                            <Section icon={<Stethoscope className="w-4 h-4" />} title="Poli Tujuan" className="mt-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-medium block mb-1 uppercase tracking-wider">Poli</label>
                                        <select value={polyId} onChange={e => { setPolyId(Number(e.target.value)); setDoctorId(null); }}
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all">
                                            {polyclinics.map((p: Poly) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-medium block mb-1 uppercase tracking-wider">Dokter</label>
                                        <select value={doctorId || ''} onChange={e => setDoctorId(e.target.value ? Number(e.target.value) : null)}
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all">
                                            <option value="">-- Pilih Dokter --</option>
                                            {filteredDoctors.map((d: DoctorOption) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </Section>

                            {/* Action */}
                            <div className="mt-5">
                                <button onClick={handleRegister}
                                    disabled={loading || (tab === 'lama' && !selectedPatient) || (tab === 'baru' && !formData.name)}
                                    className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 active:scale-[0.98]">
                                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
                                    {loading ? 'Menyimpan...' : 'Simpan & Daftarkan'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-96 text-slate-300">
                            <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                                <FileText className="w-10 h-10 text-slate-300" />
                            </div>
                            <p className="text-lg font-medium text-slate-400">Pilih nomor antrean</p>
                            <p className="text-sm text-slate-300">atau klik "Panggil Berikutnya"</p>
                        </div>
                    )}
                </main>
            </div>
            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } .animate-fadeIn { animation: fadeIn 0.3s ease-out; }`}</style>
        </>
    );
}

function QueueCard({ queue, selected, onSelect }: { queue: QueueItem; selected: boolean; onSelect: () => void }) {
    return (
        <button onClick={onSelect} className={`w-full text-left p-2.5 rounded-lg text-xs mb-1 border transition-all ${selected ? 'bg-teal-50 border-teal-300 shadow-sm' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    {queue.queue_category === 'prioritas' && <Star className="w-3 h-3 text-amber-500" />}
                    <span className="font-bold text-sm">{queue.queue_number}</span>
                </div>
                <StatusBadge status={queue.status} small />
            </div>
            <div className="text-slate-400 mt-0.5 flex items-center gap-1">
                <Stethoscope className="w-2.5 h-2.5" /> {queue.poly_name}
                <span className="text-slate-300">•</span> {queue.payment_type?.toUpperCase()}
            </div>
        </button>
    );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
    return (
        <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
            <div className="flex items-center justify-center gap-1 mb-0.5">{icon}</div>
            <div className="font-bold text-lg text-slate-700">{value}</div>
            <div className="text-[10px] text-slate-400">{label}</div>
        </div>
    );
}

function Section({ icon, title, children, className = '' }: { icon: React.ReactNode; title: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm ${className}`}>
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">{icon} {title}</h3>
            {children}
        </div>
    );
}

function FI({ icon, label, value, onChange, type = 'text', placeholder = '', disabled = false }: { icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; disabled?: boolean }) {
    return (
        <div>
            <label className="text-[10px] text-slate-500 font-medium block mb-1 uppercase tracking-wider">{label}</label>
            <div className="relative">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 [&>svg]:w-3.5 [&>svg]:h-3.5">
                    {icon}
                </div>
                <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
                    className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all" />
            </div>
        </div>
    );
}

function IR({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-1.5 text-slate-400 [&>svg]:w-3 [&>svg]:h-3">
                {icon}
                <span className="text-xs">{label}</span>
            </div>
            <span className="font-medium text-slate-700 text-xs">{value}</span>
        </div>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
    return (
        <button onClick={onClick} className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${active ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {icon} {label}
        </button>
    );
}

function StatusBadge({ status, small = false }: { status: string; small?: boolean }) {
    const styles: Record<string, string> = {
        waiting: 'bg-amber-100 text-amber-700',
        called: 'bg-blue-100 text-blue-700',
        serving: 'bg-teal-100 text-teal-700',
        registered: 'bg-emerald-100 text-emerald-700',
        skipped: 'bg-red-100 text-red-700',
        done: 'bg-slate-100 text-slate-600',
    };
    return (
        <span className={`${small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'} rounded-full font-medium ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
            {status}
        </span>
    );
}
