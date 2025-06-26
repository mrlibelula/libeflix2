<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

trait HandlesLikes
{
    /**
     * Like a model.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function like(Request $request): JsonResponse
    {
        $model = $this->getModelFromRoute($request);
        $user = $request->user();
        $itemType = $this->getItemType($model);
        
        if ($user->hasLiked($model)) {
            return response()->json([
                'success' => false,
                'message' => ucfirst($itemType) . ' already liked'
            ], 409);
        }
        
        $user->like($model);
        
        return response()->json([
            'success' => true,
            'message' => ucfirst($itemType) . ' liked successfully',
            'likes_count' => $model->likesCount(),
            'is_liked' => true
        ]);
    }

    /**
     * Unlike a model.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function unlike(Request $request): JsonResponse
    {
        $model = $this->getModelFromRoute($request);
        $user = $request->user();
        $itemType = $this->getItemType($model);
        
        if (!$user->hasLiked($model)) {
            return response()->json([
                'success' => false,
                'message' => ucfirst($itemType) . ' not liked yet'
            ], 409);
        }
        
        $user->unlike($model);
        
        return response()->json([
            'success' => true,
            'message' => ucfirst($itemType) . ' unliked successfully',
            'likes_count' => $model->likesCount(),
            'is_liked' => false
        ]);
    }

    /**
     * Get likes information for a model.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getLikes(Request $request): JsonResponse
    {
        $model = $this->getModelFromRoute($request);
        $user = $request->user();
        
        return response()->json([
            'likes_count' => $model->likesCount(),
            'is_liked' => $user ? $model->isLikedBy($user) : false
        ]);
    }

    /**
     * Get the model from the route parameters.
     *
     * @param Request $request
     * @return Model
     */
    protected function getModelFromRoute(Request $request): Model
    {
        $route = $request->route();
        
        // Check for different model types in route parameters
        if ($route->hasParameter('movie')) {
            $movieParam = $route->parameter('movie');
            if ($movieParam instanceof \App\Models\Movie) {
                return $movieParam;
            }
            // If it's a slug, find by slug, otherwise fail
            return \App\Models\Movie::where('slug', $movieParam)->firstOrFail();
        }
        
        if ($route->hasParameter('tvshow')) {
            $tvshowParam = $route->parameter('tvshow');
            if ($tvshowParam instanceof \App\Models\Tvshow) {
                return $tvshowParam;
            }
            // If it's a slug, find by slug, otherwise fail
            return \App\Models\Tvshow::where('slug', $tvshowParam)->firstOrFail();
        }
        
        if ($route->hasParameter('episode')) {
            $episodeParam = $route->parameter('episode');
            if ($episodeParam instanceof \App\Models\Episode) {
                return $episodeParam;
            }
            // If it's just an ID, load the model
            return \App\Models\Episode::findOrFail($episodeParam);
        }
        
        if ($route->hasParameter('season')) {
            $seasonParam = $route->parameter('season');
            if ($seasonParam instanceof \App\Models\Season) {
                return $seasonParam;
            }
            // If it's just an ID, load the model
            return \App\Models\Season::findOrFail($seasonParam);
        }
        
        throw new \Exception('No model found in route parameters');
    }

    /**
     * Get the item type name from the model class.
     *
     * @param Model $model
     * @return string
     */
    protected function getItemType(Model $model): string
    {
        $className = class_basename($model);
        
        return match ($className) {
            'Movie' => 'movie',
            'Tvshow' => 'TV show',
            'Episode' => 'episode',
            'Season' => 'season',
            default => strtolower($className)
        };
    }
} 