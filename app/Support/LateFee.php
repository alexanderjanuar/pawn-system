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

    /**
     * The rule that actually applies to one item: its own when the shop set a
     * special one for it, otherwise the shop-wide rule. The grace period and
     * the cap stay shop policy either way.
     *
     * @return array{mode: string, value: float, graceDays: int, maxDays: int, custom: bool}
     */
    public static function ruleFor(Transaction $transaction): array
    {
        $rule = self::settings();
        $mode = $transaction->denda_mode;

        if ($mode !== null && in_array($mode, self::MODES, true)) {
            return [
                'mode' => $mode,
                'value' => max(0, (float) $transaction->denda_value),
                // Each limit falls back to the shop's when left unset.
                'graceDays' => $transaction->denda_grace_days === null
                    ? $rule['graceDays']
                    : max(0, (int) $transaction->denda_grace_days),
                'maxDays' => $transaction->denda_max_days === null
                    ? $rule['maxDays']
                    : max(0, (int) $transaction->denda_max_days),
                'custom' => true,
            ];
        }

        return [...$rule, 'custom' => false];
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
        $rule = self::ruleFor($transaction);
        $days = max(0, self::daysLate($transaction, $on) - $rule['graceDays']);

        return $rule['maxDays'] > 0 ? min($days, $rule['maxDays']) : $days;
    }

    /**
     * Rupiah charged per late day, rounded so the figure quoted to a customer
     * stays a round "Rp x per hari" rather than a fraction.
     */
    public static function perDay(Transaction $transaction): int
    {
        $rule = self::ruleFor($transaction);

        return match ($rule['mode']) {
            'percent_principal' => (int) round($transaction->principal * $rule['value'] / 100),
            'percent_fee' => (int) round($transaction->fee * $rule['value'] / 100),
            'nominal' => (int) round($rule['value']),
            default => 0,
        };
    }

    /**
     * Late fee owed on a still-redeemable pawn. Zero when the rule is off, the
     * item is not overdue, or it has already left the shop.
     */
    public static function amount(Transaction $transaction, ?CarbonInterface $on = null): int
    {
        if (! in_array($transaction->status, self::ACCRUING, true)) {
            return 0;
        }

        // An item's own rule wins over the shop's, in both directions: it can
        // charge where the shop charges nothing, and exempt where the shop does.
        $rule = self::ruleFor($transaction);

        if ($rule['mode'] === 'off' || $rule['value'] <= 0) {
            return 0;
        }

        return self::perDay($transaction) * self::chargeableDays($transaction, $on);
    }
}
