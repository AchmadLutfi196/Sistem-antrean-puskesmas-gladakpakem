<?php

namespace App\Http\Controllers;

use App\Models\Polyclinic;
use App\Models\Queue;
use App\Models\QueueConfig;
use Illuminate\Http\Request;
use Inertia\Inertia;

class KioskController extends Controller
{
    public function index()
    {
        $polyclinics = Polyclinic::where('is_active', true)
            ->orderBy('sort_order')
            ->get()
            ->map(function ($poly) {
                $today = now()->toDateString();
                $todayCount = Queue::where('poly_id', $poly->id)
                    ->whereDate('queue_date', $today)
                    ->whereNotIn('status', ['cancelled'])
                    ->count();

                return [
                    'id' => $poly->id,
                    'name' => $poly->name,
                    'queue_prefix' => $poly->queue_prefix,
                    'quota_per_day' => $poly->quota_per_day,
                    'remaining' => max(0, $poly->quota_per_day - $todayCount),
                    'icon' => $this->getPolyIcon($poly->code),
                ];
            });

        return Inertia::render('kiosk/index', [
            'polyclinics' => $polyclinics,
            'puskesmasName' => 'Puskesmas Gladak Pakem',
            'motto' => 'Melayani Sepenuh Hati',
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'queue_category' => 'required|in:prioritas,umum',
            'priority_reason' => 'nullable|in:lansia,bumil,disabilitas,balita',
            'payment_type' => 'required|in:bpjs,umum',
            'poly_id' => 'required|exists:polyclinics,id',
        ]);

        $poly = Polyclinic::findOrFail($validated['poly_id']);
        $today = now()->toDateString();

        // Determine prefix
        $prefix = $validated['queue_category'] === 'prioritas' ? 'P' : $poly->queue_prefix;

        // Generate next queue number
        $queueNumber = Queue::generateNextNumber($prefix, $today);

        // Calculate estimated wait time
        $avgMinutes = (int) QueueConfig::getValue('avg_service_minutes', '5');
        $waitingBefore = Queue::whereDate('queue_date', $today)
            ->where('status', 'waiting')
            ->when($validated['queue_category'] === 'prioritas', function ($q) {
                $q->where('queue_category', 'prioritas');
            })
            ->count();

        $estimatedMinutes = $waitingBefore * $avgMinutes;

        $queue = Queue::create([
            'queue_number' => $queueNumber,
            'queue_prefix' => $prefix,
            'queue_category' => $validated['queue_category'],
            'priority_reason' => $validated['priority_reason'] ?? null,
            'poly_id' => $poly->id,
            'queue_date' => $today,
            'source' => 'kiosk',
            'status' => 'waiting',
            'payment_type' => $validated['payment_type'],
            'estimated_time' => now()->addMinutes($estimatedMinutes),
        ]);

        return back()->with('ticket', [
            'queue_number' => $queue->queue_number,
            'queue_category' => $queue->queue_category,
            'priority_reason' => $queue->priority_reason,
            'poly_name' => $poly->name,
            'payment_type' => $queue->payment_type,
            'date' => now()->format('d/m/Y'),
            'time' => now()->format('H:i'),
            'estimated_minutes' => $estimatedMinutes,
            'waiting_before' => $waitingBefore,
        ]);
    }

    private function getPolyIcon(string $code): string
    {
        return match ($code) {
            'POL-001' => '🩺',
            'POL-002' => '🦷',
            'POL-003' => '🤰',
            'POL-004' => '💉',
            'POL-005' => '🚑',
            default => '🏥',
        };
    }
}
