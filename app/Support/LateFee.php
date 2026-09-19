<?php

namespace App\Support;

use App\Models\Setting;
use App\Models\Transaction;
use Carbon\CarbonInterface;

/**
 * Late fee ("denda") for a pawn that passed its due date without being redeemed.
 *
 * Every part of the rule is the shop's to set: how it is calculated, how much,
 * how many days are forgiven first, and whether it stops growing after a while.
 * It is switched off until the owner configures it, so no customer is ever
 * surprised by a charge the shop did not choose.
 */
class LateFee
{
    /** Off by default: a penalty must be a deliberate decision. */
    public const DEFAULTS = [
        'denda_mode' => 'off',
        'denda_value' => '0',
        'denda_grace_days' => '0',
        'denda_max_days' => '0',
    ];

    /** How the daily charge is worked out. */
    public const MODES = ['off', 'percent_principal', 'percent_fee', 'nominal'];

    /** Statuses that can still be redeemed, so a late fee still applies. */
    private const ACCRUING = ['AKTIF', 'PERPANJANG', 'TIDAK_DIAMBIL'];

    /**
     * The shop's late-fee rule.
     *
     * @return array{mode: string, value: float, graceDays: int, maxDays: int}
     */
    public static function settings(): array
    {
        $mode = (string) Setting::get('denda_mode', self::DEFAULTS['denda_mode']);

        return [
            'mode' => in_array($mode, self::MODES, true) ? $mode : 'off',
            'value' => max(0, (float) Setting::get('denda_value', self::DEFAULTS['denda_value'])),
            'graceDays' => max(0, (int) Setting::get('denda_grace_days', self::DEFAULTS['denda_grace_days'])),
            'maxDays' => max(0, (int) Setting::get('denda_max_days', self::DEFAULTS['denda_max_days'])),
        ];
    }

    public static function isActive(): bool
    {
        $settings = self::settings();

        return $settings['mode'] !== 'off' && $settings['value'] > 0;
    }

    /**
     * Whole days past the due date, before the grace period is applied.
     */
    public static function daysLate(Transaction $transaction, ?CarbonInterface $on = null): int
    {
        $on = ($on ?? now())->copy()->startOfDay();

        return max(0, (int) $transaction->due_date->copy()->startOfDay()->diffInDays($on, false));
    }

    /**
     * Days the customer is actually charged for: late days minus the grace
     * period, and never more than the cap when one is set.
     */
    public static function chargeableDays(Transaction $transaction, ?CarbonInterface $on = null): int
    {
        $settings = self::settings();
        $days = max(0, self::daysLate($transaction, $on) - $settings['graceDays']);

        return $settings['maxDays'] > 0 ? min($days, $settings['maxDays']) : $days;
    }

    /**
     * Rupiah charged per late day, rounded so the figure quoted to a customer
     * stays a round "Rp x per hari" rather than a fraction.
     */
    public static function perDay(Transaction $transaction): int
    {
        $settings = self::settings();

        return match ($settings['mode']) {
            'percent_principal' => (int) round($transaction->principal * $settings['value'] / 100),
            'percent_fee' => (int) round($transaction->fee * $settings['value'] / 100),
            'nominal' => (int) round($settings['value']),
            default => 0,
        };
    }

    /**
     * Late fee owed on a still-redeemable pawn. Zero when the rule is off, the
     * item is not overdue, or it has already left the shop.
     */
    public static function amount(Transaction $transaction, ?CarbonInterface $on = null): int
    {
        if (! self::isActive() || ! in_array($transaction->status, self::ACCRUING, true)) {
            return 0;
        }

        return self::perDay($transaction) * self::chargeableDays($transaction, $on);
    }
}
