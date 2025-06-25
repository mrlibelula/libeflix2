import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export interface ShareData {
  title: string;
  text?: string;
  url?: string;
}

export function useWebShare() {
  const [isSharing, setIsSharing] = useState(false);

  const isSupported = useCallback(() => {
    return typeof navigator !== 'undefined' && 'share' in navigator;
  }, []);

  const share = useCallback(async (data: ShareData) => {
    if (!isSupported()) {
      // Fallback for browsers that don't support Web Share API
      fallbackShare(data);
      return;
    }

    setIsSharing(true);
    try {
      await navigator.share({
        title: data.title,
        text: data.text,
        url: data.url || window.location.href,
      });
      // Show success message only if user completed the share
      toast.success('Content shared successfully!');
    } catch (error) {
      // User cancelled or an error occurred
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error sharing:', error);
        // Fallback if sharing fails
        fallbackShare(data);
      }
      // Don't show error for user cancellation (AbortError)
    } finally {
      setIsSharing(false);
    }
  }, []);

  const fallbackShare = useCallback((data: ShareData) => {
    // Create a shareable URL
    const url = data.url || window.location.href;
    
    // Try to copy to clipboard first
    if (navigator.clipboard) {
      const shareText = `${data.title}${data.text ? '\n' + data.text : ''}\n${url}`;
      navigator.clipboard.writeText(shareText).then(() => {
        toast.success('Link copied to clipboard!');
      }).catch(() => {
        // If clipboard fails, open a simple share dialog
        openShareDialog(data);
      });
    } else {
      openShareDialog(data);
    }
  }, []);

  const openShareDialog = useCallback((data: ShareData) => {
    const url = data.url || window.location.href;
    const text = encodeURIComponent(`${data.title}${data.text ? ' - ' + data.text : ''}`);
    const encodedUrl = encodeURIComponent(url);
    
    // Create a simple modal with share options
    const shareOptions = [
      {
        name: 'Twitter',
        url: `https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}`
      },
      {
        name: 'Facebook',
        url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
      },
      {
        name: 'LinkedIn',
        url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
      },
      {
        name: 'WhatsApp',
        url: `https://wa.me/?text=${text}%20${encodedUrl}`
      }
    ];

    // Create a simple prompt for now, could be enhanced with a proper modal
    const choice = window.confirm(
      `Share "${data.title}" via:\n\n` +
      shareOptions.map((option, index) => `${index + 1}. ${option.name}`).join('\n') +
      '\n\nClick OK to copy link to clipboard, Cancel to do nothing.'
    );

    if (choice) {
      // Try to copy to clipboard as fallback
      const shareText = `${data.title}${data.text ? '\n' + data.text : ''}\n${url}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareText).then(() => {
          toast.success('Link copied to clipboard!');
        }).catch(() => {
          toast.error('Failed to copy link');
        });
      } else {
        // Create a temporary textarea to copy text
        try {
          const textArea = document.createElement('textarea');
          textArea.value = shareText;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          toast.success('Link copied to clipboard!');
        } catch (error) {
          toast.error('Failed to copy link');
        }
      }
    }
  }, []);

  return {
    share,
    isSharing,
    isSupported: isSupported(),
  };
} 