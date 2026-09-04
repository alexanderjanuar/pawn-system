<?php

use App\Support\PhoneNumber;

test('numbers typed in any style normalise to one shape', function (?string $raw, ?string $expected) {
    expect(PhoneNumber::normalize($raw))->toBe($expected);
})->with([
    'dashes' => ['0838-3620-2747', '083836202747'],
    'already plain' => ['081350371688', '081350371688'],
    'spaces' => ['0812 3344 5566', '081233445566'],
    'international' => ['+62 812 3344 5566', '081233445566'],
    'country code' => ['62812334455 66', '081233445566'],
    'bare mobile' => ['81233445566', '081233445566'],
    'landline keeps its digits' => ['0411-123456', '0411123456'],
    'empty' => ['', null],
    'null' => [null, null],
    'no digits' => ['-', null],
]);

test('numbers are displayed in readable groups', function () {
    expect(PhoneNumber::format('081233445566'))->toBe('0812-3344-5566')
        ->and(PhoneNumber::format('+62 812 3344 5566'))->toBe('0812-3344-5566')
        ->and(PhoneNumber::format('0838-3620-2747'))->toBe('0838-3620-2747')
        ->and(PhoneNumber::format(null))->toBeNull();
});

test('only plausible Indonesian mobiles count as reachable', function () {
    expect(PhoneNumber::isMobile('0812-3344-5566'))->toBeTrue()
        ->and(PhoneNumber::isMobile('+62 812 3344 5566'))->toBeTrue()
        ->and(PhoneNumber::isMobile('0411-123456'))->toBeFalse()
        ->and(PhoneNumber::isMobile('0812'))->toBeFalse()
        ->and(PhoneNumber::isMobile(null))->toBeFalse();
});
