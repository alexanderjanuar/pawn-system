import type { SVGAttributes } from 'react';

export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            {/* Phone body — the shop */}
            <rect
                x="6"
                y="2.25"
                width="12"
                height="19.5"
                rx="3"
                stroke="currentColor"
                strokeWidth="1.8"
            />
            {/* Three marks — a quiet nod to the pawnbroker's three spheres */}
            <circle cx="12" cy="8" r="1.15" fill="currentColor" />
            <circle cx="12" cy="12" r="1.15" fill="currentColor" />
            <circle cx="12" cy="16" r="1.15" fill="currentColor" />
        </svg>
    );
}
