import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TvshowSearch } from '@/components/tvshow-search';

export function TvshowSearchModal() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="group h-9 w-9 cursor-pointer">
          <Search className="!size-5 opacity-80 group-hover:opacity-100" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Search TV Shows</DialogTitle>
          <DialogDescription>
            Search through our TV show collection by title, episode, actor, director, or keywords.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-4">
          <TvshowSearch onClose={() => setIsOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
} 