import AppLayout from "@/layouts/app-layout";
import { BreadcrumbItem } from "@/types";
import { Head } from "@inertiajs/react";

export default function Movies({ movies }: { movies: Array<any> }) {

  const imgUrl = 'https://image.tmdb.org/t/p/w500/';

  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: `Movies (${movies.length})`,
      href: '/movies',
    },
  ];
  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`Movies`} />
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Movies</h1>
      </div>  
    </AppLayout>
  );
}