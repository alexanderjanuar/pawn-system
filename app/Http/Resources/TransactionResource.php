<?php

namespace App\Http\Resources;

use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * @mixin Transaction
 */
class TransactionResource extends JsonResource
{
    /**
     * Shape matching the frontend `Transaction` type.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->code,
            'detailUrl' => route('transaksi.show', $this->resource),
            'statusUrl' => route('cek-status', ['kode' => $this->code]),
            'status' => $this->status,
            'approvalStatus' => $this->approval_status,
            'approvedBy' => $this->approved_by,
            'approvedAt' => $this->approved_at?->format('Y-m-d H.i'),
            'customer' => [
                'name' => $this->customer->name,
                'phone' => $this->customer->phone,
                'address' => $this->customer->address,
                'idNumber' => $this->customer->id_number,
            ],
            'customerCode' => $this->customer->code,
            'deviceOwner' => $this->device_owner,
            'device' => [
                'name' => $this->device_name,
                'ram' => $this->device_ram,
                'storage' => $this->device_storage,
                'serial' => $this->device_serial,
                'imei1' => $this->imei_1,
                'imei2' => $this->imei_2,
                'kelengkapan' => $this->kelengkapan,
            ],
            'principal' => $this->principal,
            'tenorDays' => $this->tenor_days,
            'feePercent' => $this->fee_percent,
            'fee' => $this->fee,
            'saleValue' => $this->sale_value,
            'soldAt' => $this->sold_at?->format('Y-m-d'),
            'startDate' => $this->start_date->format('Y-m-d'),
            'dueDate' => $this->due_date->format('Y-m-d'),
            'createdAt' => $this->created_at?->toIso8601String(),
            'clerk' => $this->clerk,
            'rakId' => $this->rak_id,
            'rak' => $this->whenLoaded('rak', fn () => $this->rak?->name),
            'notes' => $this->notes,
            'extensions' => $this->extensions,
            'photos' => collect($this->photos ?? [])
                ->map(function ($photo) {
                    // Support both the legacy string shape and {path, label}.
                    $path = is_array($photo) ? ($photo['path'] ?? null) : $photo;

                    return [
                        'url' => $path
                            ? Storage::disk('public')->url($path)
                            : null,
                        'label' => is_array($photo)
                            ? ($photo['label'] ?? null)
                            : null,
                    ];
                })
                ->filter(fn (array $p) => $p['url'] !== null)
                ->values()
                ->all(),
            'ktp' => $this->ktp_path
                ? Storage::disk('public')->url($this->ktp_path)
                : null,
            'history' => $this->events
                ->sortBy('event_date')
                ->values()
                ->map(fn ($e) => [
                    'type' => $e->type,
                    'date' => $e->event_date->format('Y-m-d'),
                    'title' => $e->title,
                    'note' => $e->note,
                    'by' => $e->by,
                    'amount' => $e->amount,
                ]),
        ];
    }
}
