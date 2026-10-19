import { Link, usePage } from '@inertiajs/react';
import {
    BadgePercent,
    Banknote,
    Boxes,
    CalendarClock,
    ChartColumnBig,
    ClipboardList,
    Gavel,
    HandCoins,
    History,
    KeyRound,
    LayoutDashboard,
    PlusCircle,
    ReceiptText,
    Store,
    UserCog,
    Users,
    Wallet,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Button } from '@/components/ui/button';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import type { NavItem } from '@/types';

/** Rarely touched once the shop is set up, so the group folds away. */
const settingsNavItems: NavItem[] = [
    { title: 'Toko', href: '/pengaturan/toko', icon: Store },
    {
        title: 'Petugas',
        href: '/pengaturan/petugas',
        icon: UserCog,
        matchPrefix: true,
    },
    { title: 'Akun Login', href: '/pengaturan/akun', icon: KeyRound },
    { title: 'Dompet', href: '/pengaturan/dompet', icon: Wallet },
    { title: 'Biaya & Denda', href: '/pengaturan/biaya', icon: BadgePercent },
];

export function AppSidebar() {
    const page = usePage().props;
    // Owner/admin tools are hidden from petugas.
    const isManagement =
        page.auth.user?.role === 'owner' || page.auth.user?.role === 'admin';

    // Home differs by role: petugas has no financial dashboard.
    const homeHref = isManagement ? '/dashboard' : '/transaksi';

    // The pawn itself: taking items in, chasing due dates, who and where.
    const gadaiNavItems: NavItem[] = [
        {
            title: 'Transaksi',
            href: '/transaksi',
            icon: ClipboardList,
            matchPrefix: true,
        },
        {
            title: 'Jatuh Tempo',
            href: '/jatuh-tempo',
            icon: CalendarClock,
            badge: page.overdueCount || undefined,
            badgeTone: 'urgent',
        },
        {
            title: 'Pelanggan',
            href: '/pelanggan',
            icon: Users,
            matchPrefix: true,
        },
        { title: 'Rak', href: '/rak', icon: Boxes, matchPrefix: true },
    ];

    // Money in and out of the drawer.
    const keuanganNavItems: NavItem[] = [
        { title: 'Kas Harian', href: '/kas', icon: Banknote },
        {
            title: 'Biaya Operasional',
            href: '/biaya-operasional',
            icon: ReceiptText,
        },
        {
            title: 'Piutang',
            href: '/piutang',
            icon: HandCoins,
            matchPrefix: true,
        },
    ];

    const laporanNavItems: NavItem[] = [
        { title: 'Laporan', href: '/laporan', icon: ChartColumnBig },
        {
            title: 'Barang Lelang',
            href: '/laporan/lelang',
            icon: Gavel,
            badge: page.awaitingSaleCount || undefined,
            badgeTone: 'urgent',
        },
        { title: 'Aktivitas', href: '/aktivitas', icon: History },
    ];

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={homeHref} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent className="gap-1">
                <SidebarGroup className="px-2 pt-0 pb-1 group-data-[collapsible=icon]:px-1.5">
                    <Button
                        asChild
                        className="justify-start gap-2 shadow-sm group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                    >
                        <Link href="/gadai/baru">
                            <PlusCircle className="size-4" />
                            <span className="group-data-[collapsible=icon]:hidden">
                                Gadai Baru
                            </span>
                        </Link>
                    </Button>
                </SidebarGroup>

                {isManagement && (
                    <NavMain
                        items={[
                            {
                                title: 'Dashboard',
                                href: '/dashboard',
                                icon: LayoutDashboard,
                            },
                        ]}
                    />
                )}
                <NavMain items={gadaiNavItems} label="Gadai" />
                <NavMain items={keuanganNavItems} label="Keuangan" />
                {isManagement && (
                    <NavMain items={laporanNavItems} label="Laporan" />
                )}
                {isManagement && (
                    <NavMain
                        items={settingsNavItems}
                        label="Pengaturan"
                        collapsible
                    />
                )}
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
