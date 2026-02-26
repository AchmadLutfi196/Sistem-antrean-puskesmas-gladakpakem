<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Doctor;
use App\Models\DoctorSchedule;
use App\Models\MandatoryInfoConsent;
use App\Models\Patient;
use App\Models\Polyclinic;
use App\Models\Queue;
use App\Models\Registration;
use Illuminate\Http\Request;
use Inertia\Inertia;

class LoketController extends Controller
{
    public function index(Request $request)
    {
        $today = now()->toDateString();
        $dayOfWeek = now()->dayOfWeekIso; // 1=Monday

        // Queue list for sidebar
        $queues = Queue::with('polyclinic')
            ->whereDate('queue_date', $today)
            ->whereIn('status', ['waiting', 'called', 'serving', 'skipped'])
            ->orderByRaw("CASE WHEN queue_category = 'prioritas' THEN 0 ELSE 1 END")
            ->orderByRaw("CASE status WHEN 'serving' THEN 0 WHEN 'called' THEN 1 WHEN 'waiting' THEN 2 WHEN 'skipped' THEN 3 END")
            ->orderBy('id')
            ->get()
            ->map(fn($q) => [
                'id' => $q->id,
                'queue_number' => $q->queue_number,
                'queue_category' => $q->queue_category,
                'priority_reason' => $q->priority_reason,
                'status' => $q->status,
                'poly_name' => $q->polyclinic?->name,
                'payment_type' => $q->payment_type,
                'counter_number' => $q->counter_number,
            ]);

        // Currently serving at user's counter
        $counterNumber = $request->session()->get('counter_number', 1);
        $currentServing = Queue::with('polyclinic')
            ->whereDate('queue_date', $today)
            ->where('counter_number', $counterNumber)
            ->whereIn('status', ['called', 'serving'])
            ->orderBy('called_at', 'desc')
            ->first();

        // Polyclinics for dropdown
        $polyclinics = Polyclinic::where('is_active', true)->orderBy('sort_order')->get();

        // Today's doctors with schedules
        $doctors = Doctor::where('is_active', true)
            ->whereHas('schedules', function ($q) use ($dayOfWeek) {
                $q->where('day_of_week', $dayOfWeek)->where('is_active', true);
            })
            ->with('polyclinic')
            ->get()
            ->map(fn($d) => [
                'id' => $d->id,
                'name' => $d->name,
                'poly_id' => $d->poly_id,
                'poly_name' => $d->polyclinic?->name,
            ]);

        // Stats
        $stats = [
            'totalToday' => Queue::whereDate('queue_date', $today)->whereNotIn('status', ['cancelled'])->count(),
            'waiting' => Queue::whereDate('queue_date', $today)->where('status', 'waiting')->count(),
            'served' => Queue::whereDate('queue_date', $today)->whereIn('status', ['done', 'registered', 'directed_to_poly'])->count(),
            'skipped' => Queue::whereDate('queue_date', $today)->where('status', 'skipped')->count(),
        ];

        return Inertia::render('loket/index', [
            'queues' => $queues,
            'currentServing' => $currentServing ? [
                'id' => $currentServing->id,
                'queue_number' => $currentServing->queue_number,
                'queue_category' => $currentServing->queue_category,
                'priority_reason' => $currentServing->priority_reason,
                'status' => $currentServing->status,
                'payment_type' => $currentServing->payment_type,
                'poly_name' => $currentServing->polyclinic?->name,
            ] : null,
            'counterNumber' => $counterNumber,
            'polyclinics' => $polyclinics,
            'doctors' => $doctors,
            'stats' => $stats,
        ]);
    }

    public function setCounter(Request $request)
    {
        $validated = $request->validate([
            'counter_number' => 'required|integer|min:1|max:10',
        ]);
        $request->session()->put('counter_number', $validated['counter_number']);
        return back();
    }

    /**
     * Search patients
     */
    public function searchPatient(Request $request)
    {
        $query = Patient::query();

        if ($request->filled('medical_record')) {
            $query->where('medical_record', 'like', "%{$request->medical_record}%");
        }
        if ($request->filled('nik')) {
            $query->where('nik', 'like', "%{$request->nik}%");
        }
        if ($request->filled('bpjs_number')) {
            $query->where('bpjs_number', 'like', "%{$request->bpjs_number}%");
        }
        if ($request->filled('name')) {
            $query->where('name', 'like', "%{$request->name}%");
        }

        $patients = $query->limit(10)->get();

        return response()->json(['patients' => $patients]);
    }

    /**
     * Register patient (new or existing) from queue
     */
    public function register(Request $request)
    {
        $validated = $request->validate([
            'queue_id' => 'required|exists:queues,id',
            'patient_type' => 'required|in:baru,lama',
            'payment_type' => 'required|in:bpjs,umum',
            'poly_id' => 'required|exists:polyclinics,id',
            'doctor_id' => 'nullable|exists:doctors,id',

            // Patient info (for new patients)
            'patient_id' => 'nullable|exists:patients,id',
            'nik' => 'nullable|string|max:16',
            'name' => 'required_if:patient_type,baru|string|max:255',
            'birth_date' => 'nullable|date',
            'birth_place' => 'nullable|string|max:100',
            'gender' => 'nullable|in:L,P',
            'address' => 'nullable|string',
            'rt_rw' => 'nullable|string|max:10',
            'kelurahan' => 'nullable|string|max:100',
            'kecamatan' => 'nullable|string|max:100',
            'kabupaten' => 'nullable|string|max:100',
            'phone' => 'nullable|string|max:20',
            'blood_type' => 'nullable|string|max:3',
            'marital_status' => 'nullable|string|max:20',
            'occupation' => 'nullable|string|max:100',
            'allergy' => 'nullable|string',
            'bpjs_number' => 'nullable|string|max:20',

            // Consent
            'rights_informed' => 'boolean',
            'obligations_informed' => 'boolean',
            'service_info_given' => 'boolean',
            'general_consent' => 'boolean',

            'notes' => 'nullable|string',
        ]);

        // Create or find patient
        if ($validated['patient_type'] === 'baru') {
            $patient = Patient::create([
                'medical_record' => Patient::generateMedicalRecord(),
                'nik' => $validated['nik'] ?? null,
                'bpjs_number' => $validated['bpjs_number'] ?? null,
                'name' => $validated['name'],
                'birth_date' => $validated['birth_date'] ?? null,
                'birth_place' => $validated['birth_place'] ?? null,
                'gender' => $validated['gender'] ?? null,
                'address' => $validated['address'] ?? null,
                'rt_rw' => $validated['rt_rw'] ?? null,
                'kelurahan' => $validated['kelurahan'] ?? null,
                'kecamatan' => $validated['kecamatan'] ?? null,
                'kabupaten' => $validated['kabupaten'] ?? null,
                'phone' => $validated['phone'] ?? null,
                'blood_type' => $validated['blood_type'] ?? null,
                'marital_status' => $validated['marital_status'] ?? null,
                'occupation' => $validated['occupation'] ?? null,
                'allergy' => $validated['allergy'] ?? null,
                'patient_type' => $validated['payment_type'] === 'bpjs' ? 'bpjs' : 'umum',
            ]);
        } else {
            $patient = Patient::findOrFail($validated['patient_id']);
        }

        // Create registration
        $registration = Registration::create([
            'registration_number' => Registration::generateNumber(),
            'queue_id' => $validated['queue_id'],
            'patient_id' => $patient->id,
            'registration_date' => now()->toDateString(),
            'registration_time' => now()->toTimeString(),
            'patient_type' => $validated['patient_type'],
            'payment_type' => $validated['payment_type'],
            'poly_id' => $validated['poly_id'],
            'doctor_id' => $validated['doctor_id'] ?? null,
            'rm_status' => $validated['patient_type'] === 'baru' ? 'created' : 'retrieved',
            'info_consent_completed' => ($validated['rights_informed'] ?? false) && ($validated['obligations_informed'] ?? false) && ($validated['service_info_given'] ?? false) && ($validated['general_consent'] ?? false),
            'status' => 'processing',
            'registered_by' => auth()->id(),
            'notes' => $validated['notes'] ?? null,
        ]);

        // Create consent record
        MandatoryInfoConsent::create([
            'registration_id' => $registration->id,
            'patient_id' => $patient->id,
            'rights_informed' => $validated['rights_informed'] ?? false,
            'obligations_informed' => $validated['obligations_informed'] ?? false,
            'service_info_given' => $validated['service_info_given'] ?? false,
            'general_consent' => $validated['general_consent'] ?? false,
            'informed_by' => auth()->id(),
            'informed_at' => now(),
        ]);

        // Update queue status
        $queue = Queue::findOrFail($validated['queue_id']);
        $queue->update([
            'status' => 'registered',
            'patient_id' => $patient->id,
        ]);

        AuditLog::log('register_patient', 'registrations', $registration->id, null, [
            'registration_number' => $registration->registration_number,
            'patient_name' => $patient->name,
        ]);

        return back()->with('success', "Pendaftaran {$registration->registration_number} berhasil!");
    }

    /**
     * Complete registration and deliver RM to poly
     */
    public function deliverRM(Registration $registration)
    {
        $registration->update([
            'rm_status' => 'delivered',
            'rm_delivered_at' => now(),
            'status' => 'completed',
            'completed_at' => now(),
        ]);

        // Update queue status
        if ($registration->queue_id) {
            Queue::where('id', $registration->queue_id)->update([
                'status' => 'directed_to_poly',
                'completed_at' => now(),
            ]);
        }

        return back()->with('success', 'RM telah diantar ke poli. Pasien diarahkan ke ruang tunggu poli.');
    }
}
