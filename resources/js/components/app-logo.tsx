// import AppLogoIcon from './app-logo-icon';
import { useSidebar } from '@/components/ui/sidebar';
import { usePage } from '@inertiajs/react';
import { type SharedData } from '@/types';

export default function AppLogo() {
    const { state } = useSidebar();
    const { name } = usePage<SharedData>().props;
    const isCollapsed = state === 'collapsed';

    return (
        <>
            {/* <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-md">
                <AppLogoIcon className="size-5 fill-current text-white dark:text-black" />
            </div> */}
            <div className="flex items-center">
                <img src="/images/libeflix-web-icon.webp" alt={name} className={`size-5 ${isCollapsed ? 'ml-[0.4rem] ' : ' '}`} />
                {!isCollapsed && (
                    <div className="-mb-0.5 ml-2 grid flex-1 text-left text-[1.2rem]">
                        <span className="truncate tracking-wider text-transparent font-libeflix font-thin bg-clip-text bg-gradient-to-r from-[#ea4335] via-[#f5f5f5] dark:via-[#262626] to-[#ea4335] background-animate">LibefliX</span>
                    </div>
                )}
            </div>
        </>
    );
}
