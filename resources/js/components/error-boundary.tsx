import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { reportClientError } from '@/lib/report-error';

type Props = { children: ReactNode };

type State = { error: Error | null };

/**
 * Last line of defence for a render crash. Without it React unmounts the whole
 * tree and the clerk is left staring at a blank white page with nothing to act
 * on and nothing to report.
 *
 * Styles are inline on purpose: if the stylesheet itself is what failed (an old
 * browser that cannot parse the theme colors, for instance), a Tailwind-styled
 * fallback would be just as invisible as the blank page it replaces.
 */
export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        // Keep the detail in the console so a devtools screenshot still helps.
        console.error('Halaman gagal ditampilkan:', error, info.componentStack);
        reportClientError(error, 'render');
    }

    render(): ReactNode {
        const { error } = this.state;

        if (!error) {
            return this.props.children;
        }

        return (
            <div
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px',
                    background: '#f6f7f9',
                    fontFamily:
                        'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
                    color: '#18181b',
                }}
            >
                <div
                    style={{
                        maxWidth: '520px',
                        width: '100%',
                        background: '#ffffff',
                        border: '1px solid #e4e4e7',
                        borderRadius: '12px',
                        padding: '28px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    }}
                >
                    <h1
                        style={{
                            margin: '0 0 8px',
                            fontSize: '20px',
                            fontWeight: 600,
                        }}
                    >
                        Halaman gagal ditampilkan
                    </h1>
                    <p
                        style={{
                            margin: '0 0 20px',
                            fontSize: '14px',
                            lineHeight: 1.6,
                            color: '#52525b',
                        }}
                    >
                        Terjadi kesalahan saat menampilkan halaman ini. Data
                        yang sudah tersimpan tidak terpengaruh, tetapi isian
                        yang belum disimpan perlu diisi ulang.
                    </p>

                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '8px',
                            marginBottom: '20px',
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            style={{
                                padding: '9px 16px',
                                fontSize: '14px',
                                fontWeight: 500,
                                color: '#ffffff',
                                background: '#047857',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                            }}
                        >
                            Muat Ulang Halaman
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                window.location.href = '/dashboard';
                            }}
                            style={{
                                padding: '9px 16px',
                                fontSize: '14px',
                                fontWeight: 500,
                                color: '#18181b',
                                background: '#ffffff',
                                border: '1px solid #d4d4d8',
                                borderRadius: '8px',
                                cursor: 'pointer',
                            }}
                        >
                            Ke Dashboard
                        </button>
                    </div>

                    <details>
                        <summary
                            style={{
                                fontSize: '13px',
                                color: '#52525b',
                                cursor: 'pointer',
                            }}
                        >
                            Keterangan teknis (tolong difoto & kirim ke admin)
                        </summary>
                        <pre
                            style={{
                                margin: '10px 0 0',
                                padding: '12px',
                                fontSize: '12px',
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                background: '#f4f4f5',
                                border: '1px solid #e4e4e7',
                                borderRadius: '8px',
                                color: '#3f3f46',
                            }}
                        >
                            {error.message || String(error)}
                        </pre>
                    </details>
                </div>
            </div>
        );
    }
}
