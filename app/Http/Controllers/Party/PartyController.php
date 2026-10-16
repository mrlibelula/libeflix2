<?php

namespace App\Http\Controllers\Party;

use App\Http\Controllers\Controller;
use App\Models\Episode;
use App\Models\Movie;
use App\Models\PartyQueueItem;
use App\Models\PartyRoom;
use App\Services\PartyService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PartyController extends Controller
{
    public function __construct(private PartyService $party) {}

    public function index(Request $request)
    {
        $user = $request->user();

        return Inertia::render('party/index', [
            'publicRooms' => $this->party->listPublicRooms($user),
            'myRooms' => $this->party->listMyRooms($user),
            'absoluteMaxMembers' => PartyRoom::ABSOLUTE_MAX_MEMBERS,
            'backdropUrl' => '/images/party01.jpg',
        ]);
    }

    public function lobby(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'success' => true,
            'publicRooms' => $this->party->listPublicRooms($user),
            'myRooms' => $this->party->listMyRooms($user),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'nullable|string|max:80',
            'host_only_controls' => 'sometimes|boolean',
            'allow_chat' => 'sometimes|boolean',
            'allow_voice' => 'sometimes|boolean',
            'max_members' => 'sometimes|integer|min:2|max:'.PartyRoom::ABSOLUTE_MAX_MEMBERS,
            'is_public' => 'sometimes|boolean',
        ]);

        $room = $this->party->createRoom($request->user(), $data);

        return redirect()->route('party.theater', ['code' => $room->code]);
    }

    public function destroy(Request $request, string $code)
    {
        $room = PartyRoom::where('code', strtoupper($code))->firstOrFail();
        $this->party->deleteRoom($room, $request->user());

        if ($request->wantsJson()) {
            return response()->json(['success' => true]);
        }

        return redirect()->route('party.index');
    }

    public function join(Request $request)
    {
        $data = $request->validate([
            'code' => 'required|string|max:12',
        ]);

        $room = $this->party->joinRoom($request->user(), $data['code']);

        return redirect()->route('party.theater', ['code' => $room->code]);
    }

    public function theater(Request $request, string $code)
    {
        $room = $this->party->joinRoom($request->user(), $code);
        $snapshot = $this->party->buildSnapshot($room, $request->user());

        return Inertia::render('party/theater', [
            'code' => $room->code,
            'initialSnapshot' => $snapshot,
            'absoluteMaxMembers' => PartyRoom::ABSOLUTE_MAX_MEMBERS,
            'backdropUrl' => '/images/party01.jpg',
        ]);
    }

    public function sync(Request $request, string $code)
    {
        $room = $this->findActiveRoom($code);
        $this->assertMember($room, $request->user());

        $snapshot = $this->party->buildSnapshot(
            $room,
            $request->user(),
            $request->integer('since_chat_id') ?: null,
            $request->integer('since_signal_id') ?: null,
        );

        return response()->json(['success' => true, 'snapshot' => $snapshot]);
    }

    public function updateSettings(Request $request, string $code)
    {
        $room = $this->findActiveRoom($code);
        $data = $request->validate([
            'name' => 'sometimes|string|max:80',
            'host_only_controls' => 'sometimes|boolean',
            'allow_chat' => 'sometimes|boolean',
            'allow_voice' => 'sometimes|boolean',
            'max_members' => 'sometimes|integer|min:2|max:'.PartyRoom::ABSOLUTE_MAX_MEMBERS,
            'is_public' => 'sometimes|boolean',
        ]);

        $this->party->updateSettings($room, $request->user(), $data);

        return response()->json(['success' => true]);
    }

    public function leave(Request $request, string $code)
    {
        $room = PartyRoom::where('code', strtoupper($code))->first();
        if ($room) {
            $this->party->leaveRoom($room, $request->user());
        }

        if ($request->wantsJson()) {
            return response()->json(['success' => true]);
        }

        return redirect()->route('party.index');
    }

    public function addQueue(Request $request, string $code)
    {
        $room = $this->findActiveRoom($code);
        $data = $request->validate([
            'type' => 'required|in:movie,episode',
            'id' => 'required|integer',
        ]);

        $item = $this->party->addQueueItem($room, $request->user(), $data['type'], (int) $data['id']);

        return response()->json(['success' => true, 'item_id' => $item->id]);
    }

    public function removeQueue(Request $request, string $code, PartyQueueItem $item)
    {
        $room = $this->findActiveRoom($code);
        $this->party->removeQueueItem($room, $request->user(), $item);

        return response()->json(['success' => true]);
    }

    public function playback(Request $request, string $code)
    {
        $room = $this->findActiveRoom($code);
        $data = $request->validate([
            'is_playing' => 'sometimes|boolean',
            'position_seconds' => 'sometimes|numeric|min:0',
            'queue_item_id' => 'sometimes|integer',
        ]);

        $room = $this->party->updatePlayback($room, $request->user(), $data);

        return response()->json([
            'success' => true,
            'playback' => [
                'current_queue_item_id' => $room->current_queue_item_id,
                'is_playing' => (bool) $room->is_playing,
                'position_seconds' => (float) $room->position_seconds,
                'playback_updated_at' => optional($room->playback_updated_at)->toIso8601String(),
            ],
        ]);
    }

    public function chat(Request $request, string $code)
    {
        $room = $this->findActiveRoom($code);
        $data = $request->validate([
            'body' => 'required|string|max:1000',
        ]);

        $message = $this->party->postChat($room, $request->user(), $data['body']);

        return response()->json([
            'success' => true,
            'message' => [
                'id' => $message->id,
                'user_id' => $message->user_id,
                'user_name' => $message->user?->name,
                'body' => $message->body,
                'created_at' => optional($message->created_at)->toIso8601String(),
            ],
        ]);
    }

    public function voiceSignal(Request $request, string $code)
    {
        $room = $this->findActiveRoom($code);
        $data = $request->validate([
            'to_user_id' => 'required|integer',
            'type' => 'required|in:offer,answer,ice,mute',
            'payload' => 'required|array',
        ]);

        $signal = $this->party->postVoiceSignal($room, $request->user(), $data);

        return response()->json(['success' => true, 'id' => $signal->id]);
    }

    public function searchContent(Request $request)
    {
        $q = trim((string) $request->get('q', ''));
        if (strlen($q) < 2) {
            return response()->json(['success' => true, 'results' => []]);
        }

        $imgBase = rtrim((string) env('TMDB_IMAGE_BASE_URL_300', ''), '/');

        $movies = Movie::query()
            ->select('id', 'title', 'original_name', 'slug', 'poster_path', 'is_free', 'path')
            ->where(function ($query) use ($q) {
                $query->where('title', 'like', "%{$q}%")
                    ->orWhere('original_name', 'like', "%{$q}%");
            })
            ->whereNotNull('path')
            ->where('path', '!=', '')
            ->orderBy('title')
            ->limit(10)
            ->get()
            ->map(fn (Movie $m) => [
                'type' => 'movie',
                'id' => $m->id,
                'title' => $m->title ?: $m->original_name,
                'poster' => $m->poster_path ? $imgBase.$m->poster_path : null,
                'is_free' => (bool) $m->is_free,
                'subtitle' => 'Movie',
            ]);

        // Episodes whose title matches OR whose TV show name matches (e.g. "Two and a Half Men")
        $episodes = Episode::query()
            ->with(['season.tvshow'])
            ->where(function ($query) use ($q) {
                $query->where('name', 'like', "%{$q}%")
                    ->orWhereHas('season.tvshow', function ($tvQuery) use ($q) {
                        $tvQuery->where('name', 'like', "%{$q}%")
                            ->orWhere('original_name', 'like', "%{$q}%")
                            ->orWhere('folder_name', 'like', "%{$q}%");
                    });
            })
            ->whereNotNull('is_in_storage')
            ->where('is_in_storage', '!=', '')
            ->where('is_in_storage', '!=', '0')
            ->limit(40)
            ->get()
            ->sortBy(function (Episode $e) use ($q) {
                $tvName = strtolower((string) ($e->season?->tvshow?->name ?? ''));
                $needle = strtolower($q);
                $showMatch = $tvName !== '' && str_contains($tvName, $needle) ? 0 : 1;

                return sprintf(
                    '%d-%05d-%05d-%s',
                    $showMatch,
                    (int) ($e->season?->season_number ?? 0),
                    (int) ($e->episode_number ?? 0),
                    strtolower((string) $e->name)
                );
            })
            ->take(25)
            ->values()
            ->map(function (Episode $e) {
                $tv = $e->season?->tvshow;

                return [
                    'type' => 'episode',
                    'id' => $e->id,
                    'title' => $e->name,
                    'poster' => $e->stillUrl ?? null,
                    'is_free' => (bool) $e->is_free || (bool) ($tv?->is_free),
                    'subtitle' => trim(($tv?->name ?? 'TV').' · S'.($e->season?->season_number ?? '?').'E'.$e->episode_number),
                ];
            });

        return response()->json([
            'success' => true,
            'results' => $movies->concat($episodes)->take(30)->values(),
        ]);
    }

    private function findActiveRoom(string $code): PartyRoom
    {
        $room = PartyRoom::where('code', strtoupper($code))->firstOrFail();

        if ($room->isEnded()) {
            abort(410, 'This theater has ended.');
        }

        return $room;
    }

    private function assertMember(PartyRoom $room, $user): void
    {
        if (! $room->members()->where('user_id', $user->id)->exists()) {
            abort(403, 'You are not a member of this theater.');
        }
    }
}
