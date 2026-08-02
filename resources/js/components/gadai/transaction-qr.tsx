import { QRCodeSVG } from 'qrcode.react';

/**
 * QR Code for a transaction. Encodes an absolute URL so scanning opens the app.
 * Rendered as inline SVG: crisp on screen and in print, no network request,
 * works offline. High-contrast dark-on-white for reliable scanning (a
 * functional code, not a themed surface). Error-correction level Q (~25%)
 * keeps printed notas scannable even when smudged or folded.
 */
export function TransactionQr({
    value,
    size = 96,
    className,
}: {
    value: string;
    size?: number;
    className?: string;
}) {
    return (
        <QRCodeSVG
            value={value}
            size={size}
            level="Q"
            marginSize={2}
            bgColor="#ffffff"
            fgColor="#0a0a0a"
            className={className}
        />
    );
}
