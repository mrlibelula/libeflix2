<?php

use App\Services\Subtitles\OpenSubtitlesHash;
use App\Services\Subtitles\SubtitleConverter;
use App\Services\Subtitles\SubtitleLanguages;
use App\Services\Subtitles\SubtitleRanker;

function sampleSrt(): string
{
    return <<<SRT
1
00:00:01,000 --> 00:00:04,000
Hello there

2
00:00:04,500 --> 00:00:06,000
<font color="#fff">{\an8}Second</font> line
SRT;
}

test('converts srt cues to vtt timestamps and strips styling tags', function () {
    $result = (new SubtitleConverter)->convert(sampleSrt());

    expect($result['format'])->toBe('srt')
        ->and($result['cues'])->toHaveCount(2)
        ->and($result['cues'][0]['text'])->toBe('Hello there')
        ->and($result['cues'][1]['text'])->toBe('Second line')
        ->and($result['vtt'])->toContain('WEBVTT')
        ->and($result['vtt'])->toContain('00:00:01.000 --> 00:00:04.000')
        ->and($result['vtt'])->not->toContain('{\an8}')
        ->and($result['vtt'])->not->toContain('<font');
});

test('prepends a libeflix branding cue and does not duplicate it on re-import', function () {
    $converter = new SubtitleConverter;
    $first = $converter->convert(sampleSrt());

    expect($first['vtt'])->toContain('00:00:01.250 --> 00:00:10.500')
        ->and($first['vtt'])->toContain('<i>Libeflix</i>')
        ->and(substr_count($first['vtt'], '<i>Libeflix</i>'))->toBe(1)
        ->and($first['cues'][0]['text'])->toBe('Hello there')
        ->and($converter->hasBranding(sampleSrt()))->toBeFalse()
        ->and($converter->hasBranding($first['vtt']))->toBeTrue();

    $second = $converter->convert($first['vtt']);

    expect(substr_count($second['vtt'], '<i>Libeflix</i>'))->toBe(1)
        ->and($second['cues'])->toHaveCount(2)
        ->and($second['cues'][0]['text'])->toBe('Hello there');
});

test('normalizes crlf line endings and strips a utf-8 bom', function () {
    $srt = "1\n00:00:01,000 --> 00:00:04,000\nHello there\n\n2\n00:00:04,500 --> 00:00:06,000\nSecond line\n";
    $raw = "\xEF\xBB\xBF".str_replace("\n", "\r\n", $srt);
    $result = (new SubtitleConverter)->convert($raw);

    expect($result['cues'])->toHaveCount(2)
        ->and(collect($result['warnings'])->pluck('message')->implode(' '))->toContain('UTF-8 BOM');
});

test('converts windows-1252 accents to utf-8', function () {
    $raw = "1\n00:00:01,000 --> 00:00:02,000\nSe\xF1ora\n";
    $result = (new SubtitleConverter)->convert($raw);

    expect($result['encoding'])->toBe('Windows-1252')
        ->and($result['cues'][0]['text'])->toBe('Señora')
        ->and($result['warnings'][0]['message'])->toBe('Converted from Windows-1252');
});

test('reports empty, overlapping, and short cues', function () {
    $raw = <<<'SRT'
1
00:00:01,000 --> 00:00:04,000
One

2
00:00:03,000 --> 00:00:05,000
Two

3
00:00:06,000 --> 00:00:07,000


4
00:00:08,000 --> 00:00:08,100
Hi
SRT;

    $result = (new SubtitleConverter)->convert($raw);
    $messages = collect($result['warnings'])->pluck('message')->implode(' | ');

    expect($result['cues'])->toHaveCount(3)
        ->and($messages)->toContain('1 empty cue removed')
        ->and($messages)->toContain('1 overlapping cue')
        ->and($messages)->toContain('1 cue shorter than 300ms');
});

test('applies an offset and drops cues that move before the start', function () {
    $converter = new SubtitleConverter;
    $shifted = $converter->convert(sampleSrt(), 1500);

    expect($shifted['cues'][0]['start'])->toBe(2500)
        ->and($shifted['vtt'])->toContain('00:00:02.500 --> 00:00:05.500');

    $clamped = $converter->convert("1\n00:00:00,200 --> 00:00:00,400\nGone\n", -500);

    expect($clamped['cues'])->toBe([])
        ->and($clamped['warnings'])->toContain(['code' => 'offset', 'message' => '1 cue removed by the offset']);
});

test('pads malformed timestamps', function () {
    $raw = "1\n1:2:3,4 --> 1:2:5,50\nPadded\n";
    $result = (new SubtitleConverter)->convert($raw);

    expect($result['cues'][0]['start'])->toBe(3_723_400)
        ->and($result['vtt'])->toContain('01:02:03.400 --> 01:02:05.500');
});

test('passes vtt through with the same timing and text', function () {
    $vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello\n";
    $result = (new SubtitleConverter)->convert($vtt);

    expect($result['format'])->toBe('vtt')
        ->and($result['warnings'])->toBe([])
        ->and($result['cues'][0]['text'])->toBe('Hello')
        ->and($result['cues'][0]['start'])->toBe(1000)
        ->and($result['vtt'])->toContain('00:00:01.000 --> 00:00:04.000')
        ->and($result['vtt'])->toContain('Hello');
});

test('guesses a language from common subtitle filenames', function () {
    expect(SubtitleLanguages::guessFromFilename('Movie.en.srt'))->toBe('EN')
        ->and(SubtitleLanguages::guessFromFilename('episode_ES.srt'))->toBe('ES')
        ->and(SubtitleLanguages::guessFromFilename('movie.spanish.vtt'))->toBe('ES')
        ->and(SubtitleLanguages::normalize('pt-BR'))->toBe('BR')
        ->and(SubtitleLanguages::normalize('zh-CN'))->toBe('CN');
});

test('movie hash uses only the head and tail of the file', function () {
    $contents = str_repeat('a', 200_000);
    $contents[80_000] = 'b';
    $hash = OpenSubtitlesHash::fromString($contents);

    $middle = $contents;
    $middle[100_000] = 'z';
    $head = $contents;
    $head[10] = 'c';

    expect($hash)->not->toBeNull()
        ->and(strlen($hash))->toBe(16)
        ->and(OpenSubtitlesHash::fromString($middle))->toBe($hash)
        ->and(OpenSubtitlesHash::fromString($head))->not->toBe($hash)
        ->and(OpenSubtitlesHash::fromString('too small'))->toBeNull();
});

test('ranker prefers hash matches, then release matches, and sinks cam and ai results', function () {
    $row = fn (int $id, string $release, int $downloads, array $extra = []) => array_merge([
        'file_id' => $id,
        'file_name' => '',
        'release' => $release,
        'downloads' => $downloads,
        'hash_match' => false,
        'ai_translated' => false,
    ], $extra);

    $ranked = SubtitleRanker::rank([
        $row(1, '1080p.MA.WEB-DL.DDP5.1.Atmos.H.264-TechnobladeNeverDies', 197_280),
        $row(2, 'A.Minecraft.Movie.2025.AMZN.WEB.H264-ETHEL / YTS.MX', 164_928),
        $row(3, 'A.Minecraft.Movie.2025.1080p.TeleSync.X264.COLLECTiVE', 900_000),
        $row(4, 'A.Minecraft.Movie.2025.1080p.x264.COLLECTIVE', 179_011),
        $row(5, 'A Minecraft Movie 2025 - 1080p WEB H264-ETHEL', 5_415, ['hash_match' => true]),
        $row(6, 'A.Minecraft.Movie.(2025).WEBRip.YTS.MX', 4_342, ['ai_translated' => true]),
    ], 'A.Minecraft.Movie.2025.1080p.WEBRip.x264.AAC5.1-[YTS.MX].mp4', 'A Minecraft Movie');

    $byId = collect($ranked)->keyBy('file_id');

    expect(collect($ranked)->pluck('file_id')->all())->toBe([5, 2, 6, 1, 4, 3])
        ->and($byId[2]['release_match'])->toBeTrue()
        ->and($byId[1]['release_match'])->toBeFalse()
        ->and($byId[4]['release_match'])->toBeFalse()
        ->and($byId[3]['cam'])->toBeTrue()
        ->and($byId[6]['low_quality'])->toBeTrue();
});
