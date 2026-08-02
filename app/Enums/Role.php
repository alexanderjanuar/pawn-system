<?php

namespace App\Enums;

enum Role: string
{
    case Admin = 'admin';
    case Owner = 'owner';
    case Petugas = 'petugas';

    /** Indonesian display label. */
    public function label(): string
    {
        return match ($this) {
            self::Admin => 'Admin',
            self::Owner => 'Pemilik',
            self::Petugas => 'Petugas',
        };
    }

    /** Admin and Owner can reach management-only areas. */
    public function isManagement(): bool
    {
        return $this === self::Admin || $this === self::Owner;
    }
}
