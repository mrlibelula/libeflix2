import React from 'react';
import { StarIcon } from 'lucide-react';

interface MovieCardProps {
  movie: {
    id: number;
    title: string;
    poster_path?: string;
    poster_url?: string;
    backdrop_path?: string;
    backdrop_url?: string;
    vote_average: number;
    release_date: string;
    overview?: string;
  };
  onClick?: () => void;
  className?: string;
}

export function MovieCard({ movie, onClick, className = '' }: MovieCardProps) {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Default navigation - you can customize this
      window.location.href = `/movie/${movie.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '')}`;
    }
  };

  const imageUrl = movie.poster_url || movie.backdrop_url;
  const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : '';
  const rating = Math.round(movie.vote_average * 10);

  return (
    <div 
      className={`group cursor-pointer transition-all duration-300 hover:scale-105 ${className}`}
      onClick={handleClick}
    >
      <div className="relative overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={movie.title}
            className="w-full aspect-[2/3] object-cover transition-opacity duration-300 group-hover:opacity-80"
            loading="lazy"
          />
        ) : (
          <div className="w-full aspect-[2/3] flex items-center justify-center bg-gray-300 dark:bg-gray-700">
            <span className="text-gray-500 dark:text-gray-400 text-sm text-center p-2">
              No Image
            </span>
          </div>
        )}
        
        {/* Rating overlay */}
        {rating > 0 && (
          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <StarIcon className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span>{rating}%</span>
          </div>
        )}
      </div>
      
      <div className="mt-2 space-y-1">
        <h3 className="font-medium text-sm line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {movie.title}
        </h3>
        {releaseYear && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {releaseYear}
          </p>
        )}
      </div>
    </div>
  );
} 