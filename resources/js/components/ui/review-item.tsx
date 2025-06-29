import { Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { useState } from "react";

interface ReviewItemProps {
  review: {
    id: string;
    author: string;
    author_details: {
      name?: string;
      username?: string;
      rating?: number;
    };
    content: string;
    created_at: string;
    updated_at: string;
    url: string;
    avatar_url?: string;
    rating?: number;
  };
}

export function ReviewItem({ review }: ReviewItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const rating = review.rating || review.author_details.rating;
  const authorName = review.author_details.name || review.author;
  const createdDate = new Date(review.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Function to limit content to approximately 15 words
  const limitWords = (content: string, maxWords: number = 15) => {
    const words = content.split(/\s+/);
    if (words.length <= maxWords) return content;
    return words.slice(0, maxWords).join(' ');
  };

  const shouldShowReadMore = review.content.split(/\s+/).length > 15;

  return (
    <div className="flex flex-col gap-y-4 p-6 border border-gray-200 dark:border-gray-800 rounded-lg">
      <div className="flex items-start gap-x-4">
        <Avatar className="w-12 h-12">
          <AvatarImage 
            src={review.avatar_url} 
            alt={authorName}
          />
          <AvatarFallback className="bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
            {authorName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex flex-col gap-y-2 flex-1">
          <div className="flex items-center gap-x-3">
            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {authorName}
            </h4>
            {rating && (
              <div className="flex items-center gap-x-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {rating}/10
                </span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {createdDate}
          </p>
        </div>
      </div>
      
              <div className="pt-3 text-sm text-gray-700 dark:text-gray-400 leading-relaxed">
          <p className="whitespace-pre-wrap">
            {isExpanded ? review.content : limitWords(review.content)}
            {shouldShowReadMore && !isExpanded && '...'}
          </p>
          {shouldShowReadMore && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-block mt-2 text-rose-600 hover:text-rose-500 dark:text-rose-400 dark:hover:text-rose-300 text-sm font-medium underline cursor-pointer transition-all duration-300"
            >
              {isExpanded ? 'read less...' : 'read more...'}
            </button>
          )}
        </div>
    </div>
  );
} 