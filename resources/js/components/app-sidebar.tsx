import { Link, usePage } from '@inertiajs/react';
import {
    BadgePercent,
    Boxes,
    CalendarClock,
    History,
    KeyRound,
    LayoutDashboard,
    PlusCircle,
    Receipt,
    ScrollText,
    Store,
    UserCog,
    Users,
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

const ownerNavItems: NavItem[] = [
    { title: 'Kelola Toko', href: '/pengaturan/toko', icon: Store },
    {
        title: 'Pengaturan Biaya',
        href: '/pengaturan/biaya',
        icon: BadgePercent,
    },
    { title: 'Kelola Petugas', href: '/pengaturan/petugas', icon: UserCog },
    { title: 'Kelola Akun', href: '/pengaturan/akun', icon: KeyRound },
];

export function AppSidebar() {
    const page = usePage().props;
    // Items needing action today, for the Jatuh Tempo badge (shared prop).
    const attention = page.overdueCount;
    // Owner-only tools are hidden from petugas.
    const isManagement =
        page.auth.user?.role === 'owner' || page.auth.user?.role === 'admin';

    // Home differs by role: petugas has no financial dashboard.
    const homeHref = isManagement ? '/dashboard' : '/transaksi';

    // Operational items every role sees.
    const operationalNavItems: NavItem[] = [
        { title: 'Transaksi', href: '/transaksi', icon: Receipt },
        { title: 'Pelanggan', href: '/pelanggan', icon: Users },
        { title: 'Rak', href: '/rak', icon: Boxes },
        {
            title: 'Jatuh Tempo',
            href: '/jatuh-tempo',
            icon: CalendarClock,
            badge: attention || undefined,
            badgeTone: 'urgent',
        },
    ];

    // Dashboard, reports & audit log are management-only.
    const mainNavItems: NavItem[] = isManagement
        ? [
              { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
              ...operationalNavItems,
              { title: 'Laporan', href: '/laporan', icon: ScrollText },
              { title: 'Aktivitas', href: '/aktivitas', icon: History },
          ]
        : operationalNavItems;

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

            <SidebarContent>
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

                <NavMain items={mainNavItems} label="Operasional" />
                {isManagement && (
                    <NavMain items={ownerNavItems} label="Pemilik" />
                )}
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
