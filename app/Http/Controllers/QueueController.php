<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Queue;
use Illuminate\Http\Request;

class QueueController extends Controller
{
    /**
     * Call next queue number
     */
    public function callNext(Request $request)
    {
        $validated = $request->validate([
            'counter_number' => 'required|integer|min:1',
        ]);

        $today = now()->toDateString();
        $counterNumber = $validated['counter_number'];

        // Skip any currently-serving queue at this counter
        Queue::whereDate('queue_date', $today)
            ->where('counter_number', $counterNumber)
            ->whereIn('status', ['called', 'serving'])
            ->update(['status' => 'serving']);

        // Prioritize: pick priority first, then general
        $nextQueue = Queue::whereDate('queue_date', $today)
            ->where('status', 'waiting')
            ->orderByRaw("CASE WHEN queue_category = 'prioritas' THEN 0 ELSE 1 END")
            ->orderBy('id')
            ->first();

        if (!$nextQueue) {
            return back()->with('error', 'Tidak ada antrean yang menunggu.');
        }

        $nextQueue->update([
            'status' => 'called',
            'counter_number' => $counterNumber,
            'called_at' => now(),
        ]);

        AuditLog::log('call_queue', 'queues', $nextQueue->id, null, [
            'queue_number' => $nextQueue->queue_number,
            'counter' => $counterNumber,
        ]);

        return back()->with('success', "Memanggil nomor {$nextQueue->queue_number} ke Loket {$counterNumber}");
    }

    /**
     * Mark queue as serving (being processed at counter)
     */
    public function serve(Request $request, Queue $queue)
    {
        $queue->update([
            'status' => 'serving',
            'served_at' => now(),
        ]);

        return back()->with('success', "Melayani nomor {$queue->queue_number}");
    }

    /**
     * Skip a queue number
     */
    public function skip(Queue $queue)
    {
        $queue->update([
            'status' => 'skipped',
            'completed_at' => now(),
        ]);

        AuditLog::log('skip_queue', 'queues', $queue->id, null, [
            'queue_number' => $queue->queue_number,
        ]);

        return back()->with('success', "Nomor {$queue->queue_number} dilewati.");
    }

    /**
     * Mark queue as done
     */
    public function complete(Queue $queue)
    {
        $queue->update([
            'status' => 'done',
            'completed_at' => now(),
        ]);

        return back()->with('success', "Nomor {$queue->queue_number} selesai.");
    }

    /**
     * Recall a skipped queue
     */
    public function recall(Request $request, Queue $queue)
    {
        $validated = $request->validate([
            'counter_number' => 'required|integer|min:1',
        ]);

        $queue->update([
            'status' => 'called',
            'counter_number' => $validated['counter_number'],
            'called_at' => now(),
        ]);

        return back()->with('success', "Memanggil ulang nomor {$queue->queue_number}");
    }
}
