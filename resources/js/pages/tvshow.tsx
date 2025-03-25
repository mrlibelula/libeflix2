import { AddCircleButton } from '@/components/ui/add-circle-button';
import { LikeCircleButton } from '@/components/ui/like-circle-button';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { LoaderCircle, Play } from 'lucide-react';

export default function Tvshow({ tvshow, backdropUrl }: { tvshow: any, backdropUrl: string }) {

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: `${tvshow.name}`,
            href: '/tvshow',
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${tvshow.name}`} />
            {/* hero */}
            <div className="relative flex flex-col gap-4 min-h-[calc(100vh-5.5rem)] max-h-[calc(100vh-5.5rem)] overflow-hidden overflow-y-auto">
                <div style={{backgroundImage: `url(${backdropUrl})`, backgroundSize: 'cover', backgroundPosition: 'center'}} className="w-full h-[calc(100vh-5.5rem)]" />
                <div className="absolute light-gradient-hero dark:dark-gradient-hero h-[calc(100vh-5.5rem)] w-full" />
                <div className="flex flex-col xl:flex-row w-full absolute">
                    <div className="p-4 md:p-10 xl:p-20 top-0 left-0 w-full xl:w-[75%] flex flex-col items-start justify-start">
                        <div className="text-black dark:text-white text-4xl font-bold px-5 py-3">
                            {
                                tvshow.logo?.url ?
                                <img src={`${tvshow.logo?.url}`} alt={tvshow.name} className="w-full sm:w-1/2 object-cover" />
                                :
                                <h1 className="text-3xl md:text-4xl xl:text-6xl font-bold">{tvshow.name}</h1>
                            }
                        </div>

                        {/* hero actions */}
                        <div className="flex items-center justify-center gap-x-3 px-5 py-3 mt-6">
                            <Button className="w-full text-xl font-semibold" tabIndex={1} disabled={false}>
                                <Play className="ml-2 mr-1 h-4 w-4 fill-white dark:fill-black" />
                                Play
                                {false && <LoaderCircle className="h-4 w-4 animate-spin" />}
                                <div className="mr-2" />
                            </Button>

                            <AddCircleButton />
                            
                            <LikeCircleButton isLiked={false} />
                        </div>

                        <div className="flex items-center justify-center gap-x-3 px-5 py-3 mt-6 w-full">
                            <div className="flex items-center gap-x-8 w-full">
                                <div className="flex flex-col xl:flex-row text-base w-full sm:text-lg xl:text-xl justify-center gap-x-20 gap-y-6 xl:gap-y-0">
                                    {/* details and overview */}
                                    <div className="flex flex-col gap-x-3 gap-y-10 w-full">
                                        <div className="flex items-center gap-x-4 leading-tight">
                                            <div>{tvshow.first_air_date.substring(0, 4)}</div>
                                            <div className=" text-nowrap">{tvshow.number_of_seasons} {tvshow.number_of_seasons > 1 ? 'seasons' : 'season'}</div>
                                            <div className="border border-neutral-800 dark:border-neutral-300 rounded-md px-1.5 py-0.5">HD</div>
                                            <div className=" text-nowrap">{tvshow.number_of_episodes} episodes</div>
                                        </div>
                                        <div className="text-black dark:text-white">
                                            {tvshow.overview}
                                        </div>
                                    </div>
                                    
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* seasons */}
                    <div className="w-full xl:w-[25%] p-8 md:p-10 xl:p-20 h-[calc(100vh-5.5rem)] bg-black/50 xl:overflow-y-auto xl:overflow-hidden">
                        <div className="mx-auto w-1/3 xl:w-2/3 h-[13rem] xl:h-[18rem] rounded-xl border-2 p-1 bg-black/70 border-neutral-800 dark:border-white/40 overflow-hidden">
                            <img src={`${tvshow.seasons[0].poster_path}`} alt={tvshow.name} className="w-full h-full object-cover rounded-md" />
                        </div>
                        <select className="w-full mt-8 xl:mt-12 bg-white dark:bg-neutral-800/80 text-black dark:text-white rounded-md p-2">
                            <option value="-1" disabled selected>Select a season</option>
                            {
                                tvshow.seasons.map((season: any) => (
                                    <option value={season.id}>{season.name}</option>
                                ))
                            }
                        </select>
                        <div className="mt-8 xl:mt-12">
                            {tvshow.seasons[0].overview}
                        </div>
                        <div>
                            
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}


