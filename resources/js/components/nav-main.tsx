import { Link } from '@inertiajs/react';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/types';

export function NavMain({
    items = [],
    label = 'Platform',
}: {
    items: NavItem[];
    label?: string;
}) {
    const { isCurrentUrl } = useCurrentUrl();

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>{label}</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                            asChild
                            isActive={isCurrentUrl(item.href)}
                            tooltip={{ children: item.title }}
                            className={cn(
                                'transition-colors',
                                // enhanced current-page state: emerald icon,
                                // hairline emerald ring, semibold label
                                'data-[active=true]:font-semibold',
                                'data-[active=true]:ring-1 data-[active=true]:ring-primary/25 data-[active=true]:ring-inset',
                                'data-[active=true]:[&>svg]:text-primary',
                            )}
                        >
                            <Link href={item.href} prefetch>
                                {item.icon && <item.icon />}
                                <span>{item.title}</span>
                            </Link>
                        </SidebarMenuButton>
                        {item.badge != null && item.badge !== 0 && (
                            <SidebarMenuBadge
                                className={cn(
                                    item.badgeTone === 'urgent' &&
                                        'bg-overdue-soft text-overdue ring-1 ring-overdue/25 ring-inset',
                                )}
                            >
                                {item.badge}
                            </SidebarMenuBadge>
                        )}
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}
