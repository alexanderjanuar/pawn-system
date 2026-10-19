import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
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

function subscribeToStorage(onChange: () => void): () => void {
    window.addEventListener('storage', onChange);

    return () => window.removeEventListener('storage', onChange);
}

function readFlag(key: string): boolean {
    try {
        return window.localStorage.getItem(key) === 'open';
    } catch {
        return false;
    }
}

/**
 * One labelled group of sidebar links. A `collapsible` group (for rarely used
 * settings) folds away under its label, opens on its own when the current
 * page lives inside it, and remembers how the user left it. In the icon-only
 * sidebar every group shows its icons regardless.
 */
export function NavMain({
    items = [],
    label,
    collapsible = false,
}: {
    items: NavItem[];
    label?: string;
    collapsible?: boolean;
}) {
    const { isCurrentUrl } = useCurrentUrl();
    const isActive = (item: NavItem) =>
        isCurrentUrl(item.href, undefined, item.matchPrefix ?? false);
    const containsCurrent = items.some(isActive);
    const storageKey = `sidebar-group:${label ?? ''}`;

    // The remembered state, read so the server render (folded) and the
    // browser agree; a click in this tab overrides it straight away.
    const remembered = useSyncExternalStore(
        subscribeToStorage,
        () => readFlag(storageKey),
        () => false,
    );
    const [clicked, setClicked] = useState<boolean | null>(null);
    const open = clicked ?? remembered;

    // Being on one of its pages always shows the group.
    const expanded = open || containsCurrent;

    const menu = (
        <SidebarMenu>
            {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                        asChild
                        isActive={isActive(item)}
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
    );

    if (!collapsible) {
        return (
            <SidebarGroup className="px-2 py-0">
                {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
                {menu}
            </SidebarGroup>
        );
    }

    return (
        <Collapsible
            open={expanded}
            onOpenChange={(next) => {
                setClicked(next);

                try {
                    window.localStorage.setItem(
                        storageKey,
                        next ? 'open' : 'closed',
                    );
                } catch {
                    // Remembering is a convenience; the group still works.
                }
            }}
            className="group/collapsible"
        >
            <SidebarGroup className="px-2 py-0">
                <SidebarGroupLabel asChild>
                    <CollapsibleTrigger className="w-full justify-between hover:text-sidebar-foreground">
                        {label}
                        <ChevronRight className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </CollapsibleTrigger>
                </SidebarGroupLabel>
                {/* Kept mounted so the icon-only sidebar still shows these. */}
                <CollapsibleContent
                    forceMount
                    className="group-data-[collapsible=icon]:block! data-[state=closed]:hidden"
                >
                    {menu}
                </CollapsibleContent>
            </SidebarGroup>
        </Collapsible>
    );
}
