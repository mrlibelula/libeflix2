import AppLayout from "@/layouts/app-layout";
import { BreadcrumbItem } from "@/types";
import { Head } from "@inertiajs/react";

const breadcrumbs: BreadcrumbItem[] = [
  {
    title: 'Movies',
    href: '/movies',
  },
];


export default function Movies() {
  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`Movies`} />
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Movies</h1>
      </div>
    </AppLayout>
  );
}