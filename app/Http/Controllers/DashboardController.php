<?php

namespace App\Http\Controllers;

use App\Models\Tvshow;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index()
    {
        $tvshows = Tvshow::all();
        return Inertia::render('dashboard', [
            'tvshows' => $tvshows,
        ]);
    }
}
