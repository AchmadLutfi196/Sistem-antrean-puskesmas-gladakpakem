<?php

namespace App\Http\Controllers;

use App\Models\Queue;
use App\Models\Polyclinic;
use App\Models\QueueConfig;
use Inertia\Inertia;

class DisplayController extends Controller
{
    public function index()
    {
        return Inertia::render('display/index', $this->getDisplayData());
    }

    public function data()
    {
        return response()->json($this->getDisplayData());
    }

    private function getDisplayData(): array
    {
        $today = now()->toDateString();

        // Currently serving (called or serving status)
        $serving = Queue::with('polyclinic')
            ->whereDate('queue_date', $today)
            ->whereIn('status', ['called', 'serving'])
            ->orderBy('counter_number')
            ->get()
            ->map(fn($q) => [
                'queue_number' => $q->queue_number,
                'queue_category' => $q->queue_category,
                'priority_reason' => $q->priority_reason,
                'counter_number' => $q->counter_number ?? '-',
                'poly_name' => $q->polyclinic?->name,
            ]);

        // Priority waiting
        $priorityWaiting = Queue::with('polyclinic')
            ->whereDate('queue_date', $today)
            ->where('queue_category', 'prioritas')
            ->where('status', 'waiting')
            ->orderBy('id')
            ->limit(5)
            ->get()
            ->map(fn($q) => [
                'queue_number' => $q->queue_number,
                'priority_reason' => $q->priority_reason,
                'poly_name' => $q->polyclinic?->name,
            ]);

        // General waiting
        $generalWaiting = Queue::with('polyclinic')
            ->whereDate('queue_date', $today)
            ->where('queue_category', 'umum')
            ->where('status', 'waiting')
            ->orderBy('id')
            ->limit(5)
            ->get()
            ->map(fn($q) => [
                'queue_number' => $q->queue_number,
                'poly_name' => $q->polyclinic?->name,
            ]);

        // Stats
        $totalToday = Queue::whereDate('queue_date', $today)->whereNotIn('status', ['cancelled'])->count();
        $registered = Queue::whereDate('queue_date', $today)->whereIn('status', ['registered', 'directed_to_poly', 'done'])->count();
        $waiting = Queue::whereDate('queue_date', $today)->where('status', 'waiting')->count();
        $priorityCount = Queue::whereDate('queue_date', $today)->where('queue_category', 'prioritas')->whereNotIn('status', ['cancelled'])->count();

        // Per-poly stats
        $polyStats = Polyclinic::where('is_active', true)
            ->orderBy('sort_order')
            ->get()
            ->map(fn($p) => [
                'name' => $p->name,
                'total' => Queue::where('poly_id', $p->id)->whereDate('queue_date', $today)->whereNotIn('status', ['cancelled'])->count(),
                'waiting' => Queue::where('poly_id', $p->id)->whereDate('queue_date', $today)->where('status', 'waiting')->count(),
            ]);

        // Last called queue (for TTS announcement)
        $lastCalled = Queue::with('polyclinic')
            ->whereDate('queue_date', $today)
            ->whereIn('status', ['called', 'serving'])
            ->orderBy('called_at', 'desc')
            ->first();

        $announcement = $lastCalled
            ? "Nomor {$lastCalled->queue_number} silakan menuju LOKET {$lastCalled->counter_number}"
            : '';

        return [
            'serving' => $serving,
            'priorityWaiting' => $priorityWaiting,
            'generalWaiting' => $generalWaiting,
            'priorityRemainingCount' => Queue::whereDate('queue_date', $today)->where('queue_category', 'prioritas')->where('status', 'waiting')->count(),
            'generalRemainingCount' => Queue::whereDate('queue_date', $today)->where('queue_category', 'umum')->where('status', 'waiting')->count(),
            'totalToday' => $totalToday,
            'registered' => $registered,
            'waiting' => $waiting,
            'priorityCount' => $priorityCount,
            'polyStats' => $polyStats,
            'announcement' => $announcement,
            'puskesmasName' => 'Puskesmas Gladak Pakem',
            'motto' => 'Melayani Sepenuh Hati',
            'currentDate' => now()->translatedFormat('l, d F Y'),
            'currentTime' => now()->format('H:i') . ' WIB',
            'ttsEnabled' => QueueConfig::getValue('tts_enabled', 'true') === 'true',
        ];
    }
}
