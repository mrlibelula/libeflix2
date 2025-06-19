import React from 'react';
import { router, usePage } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Star, Play, Crown, CheckCircle } from 'lucide-react';

interface PremiumContentNoticeProps {
  type?: 'video' | 'movie' | 'episode';
  title?: string;
  description?: string;
  showUpgradeButton?: boolean;
  showLoginButton?: boolean;
  onClose?: () => void;
  className?: string;
}

export function PremiumContentNotice({ 
  type = 'video',
  title,
  description,
  showUpgradeButton = true,
  showLoginButton = true,
  onClose,
  className = ''
}: PremiumContentNoticeProps) {
  const { auth } = usePage().props as any;
  const isAuthenticated = !!auth?.user;

  const getDefaultTitle = () => {
    if (!isAuthenticated) {
      return 'Sign In Required';
    }
    
    switch (type) {
      case 'movie':
        return 'Premium Movie';
      case 'episode':
        return 'Premium Episode';
      default:
        return 'Premium Content';
    }
  };

  const getDefaultDescription = () => {
    if (!isAuthenticated) {
      return `Sign in to access this premium ${type === 'episode' ? 'episode' : 'content'}.`;
    }
    
    switch (type) {
      case 'movie':
        return 'This movie requires a premium subscription to watch.';
      case 'episode':
        return 'This episode requires a premium subscription to watch.';
      default:
        return 'This content requires a premium subscription to access.';
    }
  };

  const handleSignIn = () => {
    router.visit('/login');
  };

  const handleUpgrade = () => {
    router.visit('/subscription/plans');
  };

  const benefits = [
    'Watch all premium movies and TV shows',
    'No ads during playback',
    'HD streaming quality',
    'Download for offline viewing',
    'Access to exclusive content'
  ];

  return (
    <div className={`flex items-center justify-center p-4 ${className}`}>
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
            {!isAuthenticated ? (
              <Lock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            ) : (
              <Crown className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            )}
          </div>
          <CardTitle className="text-xl font-semibold">
            {title || getDefaultTitle()}
          </CardTitle>
          <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
            {description || getDefaultDescription()}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {!isAuthenticated ? (
            <div className="space-y-3">
              {showLoginButton && (
                <Button 
                  onClick={handleSignIn}
                  className="w-full"
                  size="lg"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Sign In to Watch
                </Button>
              )}
              
              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                Don't have an account? Sign up to start your free trial.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Premium benefits */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Premium includes:
                </h4>
                <ul className="space-y-1">
                  {benefits.slice(0, 3).map((benefit, index) => (
                    <li key={index} className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                      <CheckCircle className="mr-2 h-3 w-3 text-green-500 flex-shrink-0" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              {showUpgradeButton && (
                <Button 
                  onClick={handleUpgrade}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                  size="lg"
                >
                  <Star className="mr-2 h-4 w-4" />
                  Upgrade to Premium
                </Button>
              )}
              
              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                Cancel anytime. 7-day free trial for new subscribers.
              </p>
            </div>
          )}

          {onClose && (
            <Button 
              variant="outline" 
              onClick={onClose}
              className="w-full"
            >
              Close
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Simplified version for inline use in video players
export function InlinePremiumNotice({ 
  type = 'episode',
  onSignIn,
  onUpgrade 
}: {
  type?: 'movie' | 'episode';
  onSignIn?: () => void;
  onUpgrade?: () => void;
}) {
  const { auth } = usePage().props as any;
  const isAuthenticated = !!auth?.user;

  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
        {!isAuthenticated ? (
          <Lock className="h-8 w-8 text-orange-600 dark:text-orange-400" />
        ) : (
          <Crown className="h-8 w-8 text-orange-600 dark:text-orange-400" />
        )}
      </div>
      
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {!isAuthenticated ? 'Sign In Required' : 'Premium Content'}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {!isAuthenticated 
            ? `Sign in to access this ${type}.`
            : `This ${type} requires a premium subscription.`
          }
        </p>
      </div>

      <div className="flex flex-col space-y-2 w-full max-w-xs">
        {!isAuthenticated ? (
          <Button onClick={onSignIn || (() => router.visit('/login'))} className="w-full">
            <Play className="mr-2 h-4 w-4" />
            Sign In
          </Button>
        ) : (
          <Button 
            onClick={onUpgrade || (() => router.visit('/subscription/plans'))}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
          >
            <Star className="mr-2 h-4 w-4" />
            Upgrade to Premium
          </Button>
        )}
      </div>
    </div>
  );
} 