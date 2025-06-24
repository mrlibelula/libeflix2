import React from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { 
  Info, 
  HelpCircle, 
  AlertCircle, 
  Settings, 
  Heart, 
  Star
} from 'lucide-react';

export function TooltipDemo() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Tooltip Component Examples</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-6 border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Position Variations</h2>
          <div className="flex flex-wrap gap-8 justify-center">
            <Tooltip text="Top tooltip (default)" position="top">
              <div className="p-2 bg-rose-100 dark:bg-rose-900 rounded-md">
                <Info className="h-6 w-6" />
              </div>
            </Tooltip>
            
            <Tooltip text="Bottom tooltip" position="bottom">
              <div className="p-2 bg-rose-100 dark:bg-rose-900 rounded-md">
                <HelpCircle className="h-6 w-6" />
              </div>
            </Tooltip>
            
            <Tooltip text="Left tooltip" position="left">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-md">
                <AlertCircle className="h-6 w-6" />
              </div>
            </Tooltip>
            
            <Tooltip text="Right tooltip" position="right">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-md">
                <Settings className="h-6 w-6" />
              </div>
            </Tooltip>
          </div>
        </div>
        
        <div className="p-6 border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Variant Styles</h2>
          <div className="flex flex-wrap gap-8 justify-center">
            <Tooltip text="Dark variant (default)" variant="dark" position="top">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-md">
                <Heart className="h-6 w-6" />
              </div>
            </Tooltip>
            
            <Tooltip text="Light variant" variant="light" position="top">
              <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-md">
                <Star className="h-6 w-6" />
              </div>
            </Tooltip>
          </div>
        </div>
        
        <div className="p-6 border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Delay Variations</h2>
          <div className="flex flex-wrap gap-8 justify-center">
            <Tooltip text="Fast tooltip (100ms)" delayMs={100} position="top">
              <div className="p-2 bg-red-100 dark:bg-red-900 rounded-md flex items-center gap-2">
                <span>Fast</span>
                <Info className="h-4 w-4" />
              </div>
            </Tooltip>
            
            <Tooltip text="Default tooltip (300ms)" position="top">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-md flex items-center gap-2">
                <span>Default</span>
                <Info className="h-4 w-4" />
              </div>
            </Tooltip>
            
            <Tooltip text="Slow tooltip (800ms)" delayMs={800} position="top">
              <div className="p-2 bg-teal-100 dark:bg-teal-900 rounded-md flex items-center gap-2">
                <span>Slow</span>
                <Info className="h-4 w-4" />
              </div>
            </Tooltip>
          </div>
        </div>
        
        <div className="p-6 border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Custom Styling</h2>
          <div className="flex flex-wrap gap-8 justify-center">
            <Tooltip 
              text="Custom styled tooltip" 
              position="top" 
              className="bg-gradient-to-r from-rose-500 to-purple-500 text-white font-bold"
            >
              <div className="p-2 bg-pink-100 dark:bg-pink-900 rounded-md">
                <span>Custom</span>
              </div>
            </Tooltip>
            
            <Tooltip 
              text="With longer explanation text that wraps to multiple lines" 
              position="bottom" 
              className="max-w-[180px]"
            >
              <div className="p-2 bg-cyan-100 dark:bg-cyan-900 rounded-md">
                <span>Long Text</span>
              </div>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
} 