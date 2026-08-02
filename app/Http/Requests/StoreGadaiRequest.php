<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreGadaiRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'code_mode' => ['nullable', 'in:auto,manual'],
            'code' => ['exclude_unless:code_mode,manual', 'required', 'string', 'max:40', 'regex:/^[A-Za-z0-9.\/-]+$/', 'unique:transactions,code'],

            'customer_mode' => ['required', 'in:existing,new'],
            'customer_code' => ['required_if:customer_mode,existing', 'nullable', 'exists:customers,code'],

            'name' => ['required_if:customer_mode,new', 'nullable', 'string', 'max:120'],
            'phone' => ['required_if:customer_mode,new', 'nullable', 'string', 'max:40'],
            'address' => ['nullable', 'string', 'max:255'],
            'id_number' => ['nullable', 'string', 'max:40'],

            'device_owner' => ['nullable', 'string', 'max:120'],
            'device_name' => ['required', 'string', 'max:120'],
            'device_ram' => ['nullable', 'string', 'max:40'],
            'device_storage' => ['nullable', 'string', 'max:40'],
            'device_serial' => ['nullable', 'string', 'max:60'],
            'imei_1' => ['nullable', 'string', 'max:30'],
            'imei_2' => ['nullable', 'string', 'max:30'],
            'kelengkapan' => ['required', 'in:HP saja,HP + Box,HP + Charger,HP + Box + Charger'],

            'clerk' => ['nullable', 'string', 'max:120'],
            'rak_id' => ['nullable', 'integer', 'exists:raks,id'],
            'principal' => ['required', 'integer', 'min:1'],
            'tenor_choice' => ['required', 'in:15,30,custom'],
            'custom_days' => ['required_if:tenor_choice,custom', 'nullable', 'integer', 'min:1'],
            'custom_percent' => ['required_if:tenor_choice,custom', 'nullable', 'integer', 'min:0'],
            'start_date' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],

            'photos' => ['nullable', 'array', 'max:8'],
            'photos.*' => ['image', 'max:5120'],
            'photo_labels' => ['nullable', 'array'],
            'photo_labels.*' => ['nullable', 'string', 'max:40'],
            'ktp' => ['nullable', 'image', 'max:5120'],

            'cetak' => ['boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'code.required' => 'Nomor nota wajib diisi pada mode manual.',
            'code.unique' => 'Nomor nota ini sudah digunakan.',
            'code.regex' => 'Nomor nota hanya boleh berisi huruf, angka, titik, garis miring, dan strip.',
            'customer_code.required_if' => 'Pilih pelanggan lama terlebih dahulu.',
            'name.required_if' => 'Nama pelanggan wajib diisi.',
            'phone.required_if' => 'Nomor HP wajib diisi.',
            'device_name.required' => 'Nama HP wajib diisi.',
            'principal.min' => 'Dana titipan harus lebih dari 0.',
        ];
    }
}
