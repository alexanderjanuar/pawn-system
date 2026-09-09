/**
 * Send a browser crash to the server so it lands in the Laravel log.
 *
 * The shop runs on machines we cannot inspect, and a blank page tells nobody
 * anything. Reporting is best-effort: it must never throw, and never get in the
 * way of the error screen the clerk is looking at.
 */
export function reportClientError(
    error: unknown,
    kind: 'render' | 'runtime' | 'promise' = 'render',
): void {
    try {
        const token = document.cookie
            .split('; ')
            .find((row) => row.startsWith('XSRF-TOKEN='))
            ?.split('=')[1];

        const detail =
            error instanceof Error
                ? { message: error.message, stack: error.stack ?? null }
                : { message: String(error), stack: null };

        // The page component Inertia is showing. After a client-side visit the
        // current one lives in history state; the boot script only ever holds
        // the page the browser landed on first.
        let page: string | null = null;

        try {
            const state = window.history.state as {
                page?: { component?: string };
            } | null;

            page = state?.page?.component ?? null;

            if (!page) {
                const raw =
                    document.querySelector('script[data-page]')?.textContent;
                page = raw ? (JSON.parse(raw).component ?? null) : null;
            }
        } catch {
            page = null;
        }

        void fetch('/client-error', {
            method: 'POST',
            keepalive: true,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...(token ? { 'X-XSRF-TOKEN': decodeURIComponent(token) } : {}),
            },
            body: JSON.stringify({
                kind,
                message: detail.message.slice(0, 500),
                stack: detail.stack?.slice(0, 4000) ?? null,
                page,
                url: window.location.pathname + window.location.search,
            }),
        }).catch(() => {
            // Offline or blocked: the on-screen message is still the fallback.
        });
    } catch {
        // Reporting must never mask the original error.
    }
}
