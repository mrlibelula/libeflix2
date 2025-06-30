import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { useMobileNavigation } from '@/hooks/use-mobile-navigation';
import { type User } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { ChartLine, LogOut, Settings } from 'lucide-react';

interface UserMenuContentProps {
    user: User;
}

export function UserMenuContent({ user }: UserMenuContentProps) {
    const cleanup = useMobileNavigation();
    const { props } = usePage();

    const handleLogout = (e: React.MouseEvent) => {
        e.preventDefault();
        cleanup();
        
        // Create a form to submit logout request
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = route('logout');
        
        // Add CSRF token
        const csrfInput = document.createElement('input');
        csrfInput.type = 'hidden';
        csrfInput.name = '_token';
        csrfInput.value = props.csrf_token as string;
        form.appendChild(csrfInput);
        
        // Add the form to the page and submit it
        document.body.appendChild(form);
        form.submit();
    };

    return (
        <>
            <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <UserInfo user={user} showEmail={true} />
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(props.auth as any)?.isAdmin && (
                <>
                    <DropdownMenuGroup>
                        <DropdownMenuItem asChild>
                            <Link className="block w-full" href={route('admin.dashboard')} as="button" prefetch onClick={cleanup}>
                                <ChartLine className="mr-2" />
                                Admin Panel
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                </>
            )}
            <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                    <Link className="block w-full" href={route('profile.edit')} as="button" prefetch onClick={cleanup}>
                        <Settings className="mr-2" />
                        Settings
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
                <button className="flex w-full items-center" onClick={handleLogout}>
                    <LogOut className="mr-2" />
                    Log out
                </button>
            </DropdownMenuItem>
        </>
    );
}
