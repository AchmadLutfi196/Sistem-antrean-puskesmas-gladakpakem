<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Doctor;
use App\Models\DoctorSchedule;
use App\Models\Patient;
use App\Models\Polyclinic;
use App\Models\Queue;
use App\Models\QueueConfig;
use App\Models\Registration;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;

class AdminController extends Controller
{
    // ============================================
    // DASHBOARD
    // ============================================
    public function dashboard()
    {
        $today = now()->toDateString();

        $totalToday = Queue::whereDate('queue_date', $today)->whereNotIn('status', ['cancelled'])->count();
        $registered = Queue::whereDate('queue_date', $today)->whereIn('status', ['registered', 'directed_to_poly', 'done'])->count();
        $waiting = Queue::whereDate('queue_date', $today)->where('status', 'waiting')->count();
        $priorityCount = Queue::whereDate('queue_date', $today)->where('queue_category', 'prioritas')->whereNotIn('status', ['cancelled'])->count();

        // Patient counts
        $newPatients = Registration::whereDate('registration_date', $today)->where('patient_type', 'baru')->count();
        $oldPatients = Registration::whereDate('registration_date', $today)->where('patient_type', 'lama')->count();
        $bpjsPatients = Registration::whereDate('registration_date', $today)->where('payment_type', 'bpjs')->count();
        $umumPatients = Registration::whereDate('registration_date', $today)->where('payment_type', 'umum')->count();

        // Per-poly stats
        $polyStats = Polyclinic::where('is_active', true)
            ->orderBy('sort_order')
            ->get()
            ->map(fn($p) => [
                'name' => $p->name,
                'total' => Queue::where('poly_id', $p->id)->whereDate('queue_date', $today)->whereNotIn('status', ['cancelled'])->count(),
                'waiting' => Queue::where('poly_id', $p->id)->whereDate('queue_date', $today)->where('status', 'waiting')->count(),
                'done' => Queue::where('poly_id', $p->id)->whereDate('queue_date', $today)->whereIn('status', ['done', 'directed_to_poly'])->count(),
            ]);

        // Average wait time (approximate)
        $avgWaitMinutes = Queue::whereDate('queue_date', $today)
            ->whereNotNull('called_at')
            ->whereNotNull('created_at')
            ->get()
            ->avg(fn($q) => $q->called_at->diffInMinutes($q->created_at));

        return Inertia::render('admin/dashboard', [
            'stats' => [
                'totalToday' => $totalToday,
                'registered' => $registered,
                'waiting' => $waiting,
                'priorityCount' => $priorityCount,
                'newPatients' => $newPatients,
                'oldPatients' => $oldPatients,
                'bpjsPatients' => $bpjsPatients,
                'umumPatients' => $umumPatients,
                'avgWaitMinutes' => round($avgWaitMinutes ?? 0),
            ],
            'polyStats' => $polyStats,
        ]);
    }

    // ============================================
    // POLYCLINICS CRUD
    // ============================================
    public function polyclinics()
    {
        $polyclinics = Polyclinic::orderBy('sort_order')->get();
        return Inertia::render('admin/polyclinics', ['polyclinics' => $polyclinics]);
    }

    public function storePolyclinic(Request $request)
    {
        $validated = $request->validate([
            'code' => 'required|unique:polyclinics,code|max:10',
            'name' => 'required|max:100',
            'bpjs_poly_code' => 'nullable|max:10',
            'room' => 'nullable|max:50',
            'queue_prefix' => 'required|max:5',
            'quota_per_day' => 'integer|min:1',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ]);

        Polyclinic::create($validated);
        AuditLog::log('create', 'polyclinics');
        return back()->with('success', 'Poliklinik berhasil ditambahkan.');
    }

    public function updatePolyclinic(Request $request, Polyclinic $polyclinic)
    {
        $validated = $request->validate([
            'code' => "required|unique:polyclinics,code,{$polyclinic->id}|max:10",
            'name' => 'required|max:100',
            'bpjs_poly_code' => 'nullable|max:10',
            'room' => 'nullable|max:50',
            'queue_prefix' => 'required|max:5',
            'quota_per_day' => 'integer|min:1',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ]);

        $polyclinic->update($validated);
        return back()->with('success', 'Poliklinik berhasil diupdate.');
    }

    public function destroyPolyclinic(Polyclinic $polyclinic)
    {
        $polyclinic->delete();
        return back()->with('success', 'Poliklinik berhasil dihapus.');
    }

    // ============================================
    // DOCTORS CRUD
    // ============================================
    public function doctors()
    {
        $doctors = Doctor::with('polyclinic', 'schedules')->orderBy('name')->get();
        $polyclinics = Polyclinic::where('is_active', true)->orderBy('sort_order')->get();
        return Inertia::render('admin/doctors', [
            'doctors' => $doctors,
            'polyclinics' => $polyclinics,
        ]);
    }

    public function storeDoctor(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|max:255',
            'nip' => 'nullable|max:30',
            'sip_number' => 'nullable|max:50',
            'specialization' => 'nullable|max:100',
            'poly_id' => 'required|exists:polyclinics,id',
            'bpjs_doctor_code' => 'nullable|max:20',
            'is_active' => 'boolean',
        ]);

        Doctor::create($validated);
        return back()->with('success', 'Dokter berhasil ditambahkan.');
    }

    public function updateDoctor(Request $request, Doctor $doctor)
    {
        $validated = $request->validate([
            'name' => 'required|max:255',
            'nip' => 'nullable|max:30',
            'sip_number' => 'nullable|max:50',
            'specialization' => 'nullable|max:100',
            'poly_id' => 'required|exists:polyclinics,id',
            'bpjs_doctor_code' => 'nullable|max:20',
            'is_active' => 'boolean',
        ]);

        $doctor->update($validated);
        return back()->with('success', 'Dokter berhasil diupdate.');
    }

    public function destroyDoctor(Doctor $doctor)
    {
        $doctor->delete();
        return back()->with('success', 'Dokter berhasil dihapus.');
    }

    // ============================================
    // USERS CRUD
    // ============================================
    public function users()
    {
        $users = User::orderBy('name')->get()->map(fn($u) => [
            'id' => $u->id,
            'username' => $u->username,
            'name' => $u->name,
            'email' => $u->email,
            'role' => $u->role,
            'phone' => $u->phone,
            'is_active' => $u->is_active,
            'last_login' => $u->last_login?->format('d/m/Y H:i'),
        ]);
        return Inertia::render('admin/users', ['users' => $users]);
    }

    public function storeUser(Request $request)
    {
        $validated = $request->validate([
            'username' => 'required|unique:users,username|max:50',
            'name' => 'required|max:255',
            'email' => 'nullable|email|unique:users,email|max:100',
            'password' => 'required|min:8',
            'role' => 'required|in:admin,receptionist',
            'phone' => 'nullable|max:20',
            'is_active' => 'boolean',
        ]);

        $validated['password'] = Hash::make($validated['password']);
        User::create($validated);
        return back()->with('success', 'User berhasil ditambahkan.');
    }

    public function updateUser(Request $request, User $user)
    {
        $validated = $request->validate([
            'username' => "required|unique:users,username,{$user->id}|max:50",
            'name' => 'required|max:255',
            'email' => "nullable|email|unique:users,email,{$user->id}|max:100",
            'password' => 'nullable|min:8',
            'role' => 'required|in:admin,receptionist',
            'phone' => 'nullable|max:20',
            'is_active' => 'boolean',
        ]);

        if (!empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user->update($validated);
        return back()->with('success', 'User berhasil diupdate.');
    }

    public function destroyUser(User $user)
    {
        if ($user->id === auth()->id()) {
            return back()->with('error', 'Tidak bisa menghapus akun sendiri.');
        }
        $user->delete();
        return back()->with('success', 'User berhasil dihapus.');
    }

    // ============================================
    // QUEUE CONFIG
    // ============================================
    public function queueConfig()
    {
        $configs = QueueConfig::orderBy('config_key')->get();
        return Inertia::render('admin/queue-config', ['configs' => $configs]);
    }

    public function updateQueueConfig(Request $request)
    {
        $validated = $request->validate([
            'configs' => 'required|array',
            'configs.*.config_key' => 'required|string',
            'configs.*.config_value' => 'required|string',
        ]);

        foreach ($validated['configs'] as $config) {
            QueueConfig::setValue($config['config_key'], $config['config_value'], auth()->id());
        }

        return back()->with('success', 'Konfigurasi berhasil disimpan.');
    }

    // ============================================
    // AUDIT LOG
    // ============================================
    public function auditLog(Request $request)
    {
        $logs = AuditLog::with('user')
            ->orderBy('created_at', 'desc')
            ->limit(100)
            ->get()
            ->map(fn($log) => [
                'id' => $log->id,
                'user_name' => $log->user?->name ?? 'System',
                'action' => $log->action,
                'table_name' => $log->table_name,
                'record_id' => $log->record_id,
                'ip_address' => $log->ip_address,
                'created_at' => $log->created_at->format('d/m/Y H:i:s'),
            ]);

        return Inertia::render('admin/audit-log', ['logs' => $logs]);
    }
}
