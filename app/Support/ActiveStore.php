<?php

namespace App\Support;

/**
 * Holds the store the current request operates on. A null id means "all stores"
 * (management overview) or a single-shop setup with no stores yet, in which
 * case store-scoped queries apply no filter.
 */
class ActiveStore
{
    private ?int $id = null;

    public function set(?int $id): void
    {
        $this->id = $id;
    }

    public function id(): ?int
    {
        return $this->id;
    }

    public function isAll(): bool
    {
        return $this->id === null;
    }
}
