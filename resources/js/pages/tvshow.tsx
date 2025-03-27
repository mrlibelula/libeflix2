import { AddCircleButton } from '@/components/ui/add-circle-button';
import { LikeCircleButton } from '@/components/ui/like-circle-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { LoaderCircle, Play } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel"

import { toast } from "sonner"
import { useState, useEffect } from 'react';

export default function Tvshow({ tvshow, backdropUrl }: { tvshow: any, backdropUrl: string }) {
  const [api, setApi] = useState<CarouselApi>();
  const [selectedSnap, setSelectedSnap] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  useEffect(() => {
    if (!api) return;

    setScrollSnaps(api.scrollSnapList());

    api.on("select", () => {
      setSelectedSnap(api.selectedScrollSnap());
    });
  }, [api]);

  const scrollTo = (index: number) => {
    api?.scrollTo(index);
  };

  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: `${tvshow.name} - TV Show`,
      href: '/tvshow',
    },
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`${tvshow.name}`} />
      {/* hero */}
      <div className="relative flex flex-col gap-4 min-h-[calc(100vh-5.5rem)] max-h-[calc(100vh-5.5rem)] overflow-hidden overflow-y-auto">
        <div style={{ backgroundImage: `url(${backdropUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} className="w-full h-[calc(100vh-5.5rem)]" />
        <div className="absolute light-gradient-hero dark:dark-gradient-hero h-[calc(100vh-5.5rem)] w-full" />
        <div className="flex flex-col xl:flex-row w-full absolute">
          <div className="p-4 md:p-10 xl:p-20 top-0 left-0 w-full _xl:w-[75%] flex flex-col items-start justify-start">
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
              <Button className="text-xl font-semibold h-[3rem]" tabIndex={1} disabled={false}>
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
                      <div className="border border-neutral-800 dark:border-neutral-300 rounded-md px-1.5 py-0.5 backdrop-blur">HD</div>
                      <div className=" text-nowrap">{tvshow.number_of_episodes} episodes</div>
                    </div>
                    <div className="text-black dark:text-white w-full xl:w-[85%] 2xl:w-[60%]">
                      {tvshow.overview}
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* carousel */}
            <div className="px-5 py-3 mt-10 w-full bg-red-600/30_">
              <div className="relative">
                <Carousel
                  opts={{
                    align: "start",
                    dragFree: true,
                  }}
                  className="w-full"
                  setApi={setApi}
                >
                  <CarouselPrevious className="absolute left-0 mt-2 top-1/3 -translate-x-1.5 z-40" />
                  <CarouselNext className="absolute right-0 mt-2 top-1/3 translate-x-1.5 z-40" />
                  <CarouselContent>
                    {tvshow.seasons.map((season: any, index: number) => (
                      <CarouselItem key={index} className="basis-1/1 sm:basis-1/2 md:basis-1/2 lg:basis-1/3 xl:basis-1/4 2xl:basis-1/6 3xl:basis-1/7">
                        <div className="mx-auto w-[10rem] h-[15rem] bg-cover bg-center shadow-lg shadow-neutral-500 dark:shadow-black/70 rounded-md overflow-hidden" style={{ backgroundImage: `url(${season.poster_path})` }}>
                          

                        </div>
                        <div className=" mt-6 font-semibold text-sm mb-4 rounded-md text-center w-full">
                          {season.name}
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <div className="flex items-center justify-between w-full gap-x-8">
                    <div className="flex w-full items-center justify-center lg:justify-start ml-8 gap-2 py-4">
                      {scrollSnaps.length > 1 && scrollSnaps.map((_, index) => (
                        <button
                          key={index}
                          className={`w-2 h-2 rounded-full transition-colors ${index === selectedSnap
                            ? 'dark:bg-white bg-black'
                            : 'dark:bg-white/50 bg-black/20 hover:dark:bg-white/75 hover:bg-black/75'
                            }`}
                          onClick={() => scrollTo(index)}
                        />
                      ))}
                    </div>
                  </div>
                </Carousel>
              </div>

              {/* <Button
                variant="outline"
                onClick={() =>
                  toast("Catch up on your favorite TV shows", {
                    description: "Sunday, December 03, 2025 at 9:00 AM",
                    action: {
                      label: "Undo",
                      onClick: () => console.log("Undo"),
                    },
                  })
                }
              >
                Show Toast
              </Button>

              <Tabs defaultValue="account" className="w-[400px]_ w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="account">Account</TabsTrigger>
                  <TabsTrigger value="password">Password</TabsTrigger>
                </TabsList>
                <TabsContent value="account">
                  <Card>
                    <CardHeader>
                      <CardTitle>Account</CardTitle>
                      <CardDescription>
                        Make changes to your account here. Click save when you're done.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="space-y-1">
                        <Label htmlFor="name">Name</Label>
                        <Input id="name" defaultValue="Pedro Duarte" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="username">Username</Label>
                        <Input id="username" defaultValue="@peduarte" />
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button>Save changes</Button>
                    </CardFooter>
                  </Card>
                </TabsContent>
                <TabsContent value="password">
                  <Card>
                    <CardHeader>
                      <CardTitle>Password</CardTitle>
                      <CardDescription>
                        Change your password here. After saving, you'll be logged out.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="space-y-1">
                        <Label htmlFor="current">Current password</Label>
                        <Input id="current" type="password" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="new">New password</Label>
                        <Input id="new" type="password" />
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button>Save password</Button>
                    </CardFooter>
                  </Card>
                </TabsContent>
              </Tabs> */}
            </div>
          </div>

          {/* right panel - seasons */}
          {/* <div className="w-full xl:w-[25%] p-8 md:p-10 xl:p-20 h-[calc(100vh-5.5rem)] bg-black/50 xl:overflow-y-auto xl:overflow-hidden">
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
                    </div> */}
        </div>
      </div>
    </AppLayout>
  );
}


