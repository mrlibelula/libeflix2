// import AppLogoIcon from './app-logo-icon';
import { useSidebar } from '@/components/ui/sidebar';

export default function AppLogo() {
    const { state } = useSidebar();
    const isCollapsed = state === 'collapsed';

    return (
        <>
            {/* <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-md">
                <AppLogoIcon className="size-5 fill-current text-white dark:text-black" />
            </div> */}
            <div className="flex items-center">
                <img src="/images/libeflix-web-icon.webp" alt="StreamLab" className={`size-5 ${isCollapsed ? 'ml-[0.4rem]' : ''}`} />
                {!isCollapsed && (
                    <div className="ml-1 grid flex-1 text-left text-sm">
                        <span className="mb-0.5 truncate leading-none font-semibold">StreamLab</span>
                    </div>
                )}
            </div>
        </>
    );
}
