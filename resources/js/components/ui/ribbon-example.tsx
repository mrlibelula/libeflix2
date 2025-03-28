import * as React from "react"
import { Ribbon, RibbonItem } from "@/components/ui/ribbon"
import { type CarouselApi } from "@/components/ui/carousel"

type ExampleItem = {
  id: number
  name: string
  image: string
}

export function RibbonExample() {
  // Example items data
  const items: ExampleItem[] = [
    { id: 1, name: "Item 1", image: "https://via.placeholder.com/150" },
    { id: 2, name: "Item 2", image: "https://via.placeholder.com/150" },
    { id: 3, name: "Item 3", image: "https://via.placeholder.com/150" },
    { id: 4, name: "Item 4", image: "https://via.placeholder.com/150" },
    { id: 5, name: "Item 5", image: "https://via.placeholder.com/150" },
  ]

  // Optional: Track carousel API if needed
  const [api, setApi] = React.useState<CarouselApi>()
  
  const handleApiInitialized = (api: CarouselApi) => {
    setApi(api)
    // You can also set up additional event listeners here
  }

  return (
    <div className="w-full p-6">
      <h2 className="font-semibold mb-8">Example Ribbon:</h2>
      
      <Ribbon 
        align="start"
        dragFree={true}
        navPosition="top"
        onApiInitialized={handleApiInitialized}
      >
        {items.map((item) => (
          <RibbonItem key={item.id}>
            <div 
              className="mx-auto w-[10rem] h-[15rem] bg-cover bg-center shadow-lg shadow-neutral-500 dark:shadow-black/70 rounded-md overflow-hidden opacity-90 group-hover:opacity-100 transition-opacity duration-150" 
              style={{ backgroundImage: `url(${item.image})` }}
            />
            <div className="mt-6 text-sm mb-4 rounded-md text-center w-full text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-neutral-100 transition-colors duration-150">
              {item.name}
            </div>
          </RibbonItem>
        ))}
      </Ribbon>
    </div>
  )
} 