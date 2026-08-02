<?php

namespace App\Http\Resources;

use App\Models\Customer;
use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Customer
 */
class CustomerResource extends JsonResource
{
    /**
     * Shape matching the frontend `Customer` type.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->code,
            'name' => $this->name,
            'phone' => $this->phone,
            'address' => $this->address,
            'idNumber' => $this->id_number,
            'joinDate' => $this->join_date->format('Y-m-d'),
            'notes' => $this->notes,
            'blacklisted' => $this->blacklisted_at !== null,
            'blacklistReason' => $this->blacklist_reason,
            'transactions' => $this->whenLoaded('transactions', fn () => $this->transactions
                ->sortByDesc('start_date')
                ->map(fn (Transaction $transaction): array => [
                    'id' => $transaction->code,
                    'device' => $transaction->device_name,
                    'principal' => $transaction->principal,
                    'status' => $transaction->status,
                    'date' => $transaction->start_date->format('Y-m-d'),
                    'detailUrl' => route('transaksi.show', $transaction),
                ])
                ->values()
                ->all()),
        ];
    }
}
