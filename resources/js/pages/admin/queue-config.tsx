import AdminLayout from '@/layouts/admin-layout';
import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import Swal from 'sweetalert2';
import {
    Settings, Save, Clock, Users, Volume2,
    Timer, MessageSquare, Bell, RotateCcw,
    Percent
} from 'lucide-react';

interface QueueConfigItem {
    id: number; config_key: string; config_value: string; description: string | null;
}

const CONFIG_META: Record<string, { label: string; icon: React.ReactNode; group: string; type: 'text' | 'time' | 'toggle' | 'number' }> = {
    operating_start:     { label: 'Jam Mulai Operasional',          icon: <Clock className="w-4 h-4 text-sky-500" />,          group: 'Jadwal Operasional', type: 'time' },
    operating_end:       { label: 'Jam Selesai Operasional',        icon: <Clock className="w-4 h-4 text-orange-500" />,       group: 'Jadwal Operasional', type: 'time' },
    reset_time:          { label: 'Waktu Reset Antrean Harian',     icon: <RotateCcw className="w-4 h-4 text-purple-500" />,   group: 'Jadwal Operasional', type: 'time' },
    avg_service_minutes: { label: 'Estimasi Waktu Layanan (menit)', icon: <Timer className="w-4 h-4 text-emerald-500" />,      group: 'Pengaturan Antrean', type: 'number' },
    priority_ratio:      { label: 'Rasio Prioritas : Umum',         icon: <Percent className="w-4 h-4 text-amber-500" />,      group: 'Pengaturan Antrean', type: 'text' },
    tts_enabled:         { label: 'Text-to-Speech Panggilan',       icon: <Volume2 className="w-4 h-4 text-teal-500" />,       group: 'Notifikasi',         type: 'toggle' },
    wa_notification:     { label: 'Notifikasi WhatsApp',            icon: <MessageSquare className="w-4 h-4 text-green-500" />,group: 'Notifikasi',         type: 'toggle' },
    wa_notify_before:    { label: 'Notif Sebelum Giliran (antrian)',icon: <Bell className="w-4 h-4 text-rose-500" />,          group: 'Notifikasi',         type: 'number' },
};

export default function QueueConfigPage() {
    const { configs } = usePage().props as any;
    const [formData, setFormData] = useState<Record<string, string>>(() => {
        const data: Record<string, string> = {};
        (configs as QueueConfigItem[]).forEach((c) => { data[c.config_key] = c.config_value; });
        return data;
    });
    const [saving, setSaving] = useState(false);

    const handleSave = () => {
        setSaving(true);
        const payload = Object.entries(formData).map(([config_key, config_value]) => ({ config_key, config_value }));
        router.post('/admin/queue-config', { configs: payload }, {
            preserveScroll: true,
            onSuccess: () => {
                setSaving(false);
                Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Konfigurasi berhasil disimpan.', confirmButtonColor: '#0d9488', timer: 2000, timerProgressBar: true });
            },
            onError: () => {
                setSaving(false);
                Swal.fire({ icon: 'error', title: 'Gagal!', text: 'Terjadi kesalahan saat menyimpan.', confirmButtonColor: '#0d9488' });
            },
        });
    };

    // Group configs
    const configList = configs as QueueConfigItem[];
    const groups: Record<string, QueueConfigItem[]> = {};
    configList.forEach((c) => {
        const meta = CONFIG_META[c.config_key];
        const group = meta?.group || 'Lainnya';
        if (!groups[group]) groups[group] = [];
        groups[group].push(c);
    });

    const groupIcons: Record<string, React.ReactNode> = {
        'Jadwal Operasional': <Clock className="w-4 h-4 text-sky-500" />,
        'Pengaturan Antrean': <Settings className="w-4 h-4 text-amber-500" />,
        'Notifikasi': <Bell className="w-4 h-4 text-rose-500" />,
        'Lainnya': <Settings className="w-4 h-4 text-slate-400" />,
    };

    return (
        <AdminLayout title="Konfigurasi Antrean">
            {/* Save Button - Top */}
            <div className="flex items-center justify-between mb-5">
                <p className="text-sm text-slate-500">Atur pengaturan sistem antrean puskesmas.</p>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                    {saving ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    Simpan Konfigurasi
                </button>
            </div>

            {/* Config Groups */}
            <div className="space-y-5">
                {Object.entries(groups).map(([groupName, items]) => (
                    <div key={groupName} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        {/* Group Header */}
                        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                            {groupIcons[groupName]}
                            <h3 className="text-sm font-bold text-slate-700">{groupName}</h3>
                        </div>

                        {/* Group Items */}
                        <div className="divide-y divide-slate-100">
                            {items.map((config) => {
                                const meta = CONFIG_META[config.config_key];
                                const label = meta?.label || config.config_key;
                                const icon = meta?.icon || <Settings className="w-4 h-4 text-slate-400" />;
                                const type = meta?.type || 'text';

                                return (
                                    <div key={config.id} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                                        {/* Icon */}
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                                            {icon}
                                        </div>

                                        {/* Label & Description */}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-slate-700">{label}</div>
                                            {config.description && (
                                                <div className="text-xs text-slate-400 mt-0.5">{config.description}</div>
                                            )}
                                        </div>

                                        {/* Input */}
                                        <div className="shrink-0">
                                            {type === 'toggle' ? (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setFormData({ ...formData, [config.config_key]: formData[config.config_key] === 'true' ? 'false' : 'true' })}
                                                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                                                            formData[config.config_key] === 'true' ? 'bg-teal-500' : 'bg-slate-300'
                                                        }`}
                                                    >
                                                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 shadow-sm ${
                                                            formData[config.config_key] === 'true' ? 'translate-x-6' : 'translate-x-1'
                                                        }`} />
                                                    </button>
                                                    <span className={`text-xs font-medium min-w-[50px] ${formData[config.config_key] === 'true' ? 'text-teal-600' : 'text-slate-400'}`}>
                                                        {formData[config.config_key] === 'true' ? 'Aktif' : 'Nonaktif'}
                                                    </span>
                                                </div>
                                            ) : type === 'time' ? (
                                                <input
                                                    type="time"
                                                    value={formData[config.config_key] || ''}
                                                    onChange={e => setFormData({ ...formData, [config.config_key]: e.target.value })}
                                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all w-32"
                                                />
                                            ) : type === 'number' ? (
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={formData[config.config_key] || ''}
                                                    onChange={e => setFormData({ ...formData, [config.config_key]: e.target.value })}
                                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all w-24 text-center"
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={formData[config.config_key] || ''}
                                                    onChange={e => setFormData({ ...formData, [config.config_key]: e.target.value })}
                                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all w-40"
                                                />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Save Button - Bottom */}
            <div className="mt-5 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                    {saving ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    Simpan Konfigurasi
                </button>
            </div>
        </AdminLayout>
    );
}
