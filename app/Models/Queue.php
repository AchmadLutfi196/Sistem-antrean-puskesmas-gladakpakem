<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Queue extends Model
{
    protected $fillable = [
        'queue_number', 'queue_prefix', 'queue_category', 'priority_reason',
        'patient_id', 'poly_id', 'doctor_id', 'queue_date', 'source',
        'status', 'payment_type', 'counter_number', 'estimated_time',
        'called_at', 'served_at', 'completed_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'queue_date' => 'date',
            'estimated_time' => 'datetime',
            'called_at' => 'datetime',
            'served_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function polyclinic(): BelongsTo
    {
        return $this->belongsTo(Polyclinic::class, 'poly_id');
    }

    public function doctor(): BelongsTo
    {
        return $this->belongsTo(Doctor::class);
    }

    public function createdByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function registration()
    {
        return $this->hasOne(Registration::class);
    }

    public function isPriority(): bool
    {
        return $this->queue_category === 'prioritas';
    }

    /**
     * Generate next queue number for given prefix and date
     */
    public static function generateNextNumber(string $prefix, string $date): string
    {
        $lastQueue = static::where('queue_prefix', $prefix)
            ->whereDate('queue_date', $date)
            ->orderByRaw("CAST(SUBSTR(queue_number, INSTR(queue_number, '-') + 1) AS INTEGER) DESC")
            ->first();

        $nextNum = 1;
        if ($lastQueue) {
            $parts = explode('-', $lastQueue->queue_number);
            $nextNum = ((int) end($parts)) + 1;
        }

        return $prefix . '-' . str_pad($nextNum, 3, '0', STR_PAD_LEFT);
    }
}
