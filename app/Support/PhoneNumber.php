<?php

namespace App\Support;

/**
 * One canonical shape for Indonesian phone numbers.
 *
 * Numbers arrive typed by hand in every style: "0838-3620-2747",
 * "081350371688", "+62 812 3344 5566". Storing them as-is makes the same
 * person look like two, and breaks WhatsApp sending. Every write normalises to
 * plain digits starting with 0; display adds the dashes back.
 */
class PhoneNumber
{
    /**
     * Plain digits starting with 0, e.g. "081233445566". Null when blank.
     * Anything that does not look like an Indonesian number is kept as typed
     * (minus separators) rather than mangled.
     */
    public static function normalize(?string $raw): ?string
    {
        if (blank($raw)) {
            return null;
        }

        $digits = preg_replace('/\D+/', '', $raw) ?? '';

        if ($digits === '') {
            return null;
        }

        // +62 / 62 country code, or a bare "8…" mobile, become a leading 0.
        if (str_starts_with($digits, '62')) {
            $digits = '0'.substr($digits, 2);
        } elseif (str_starts_with($digits, '8')) {
            $digits = '0'.$digits;
        }

        return $digits;
    }

    /**
     * Readable form for notas and screens, e.g. "0812-3344-5566".
     */
    public static function format(?string $raw): ?string
    {
        $digits = self::normalize($raw);

        if ($digits === null) {
            return null;
        }

        if (! str_starts_with($digits, '0') || strlen($digits) < 9) {
            return $digits;
        }

        return implode('-', array_filter([
            substr($digits, 0, 4),
            substr($digits, 4, 4),
            substr($digits, 8),
        ], fn (string $part): bool => $part !== ''));
    }

    /**
     * Whether the number looks like a reachable Indonesian mobile, so a blast
     * is not attempted against a landline or a typo.
     */
    public static function isMobile(?string $raw): bool
    {
        $digits = self::normalize($raw);

        return $digits !== null
            && str_starts_with($digits, '08')
            && strlen($digits) >= 10
            && strlen($digits) <= 15;
    }
}
