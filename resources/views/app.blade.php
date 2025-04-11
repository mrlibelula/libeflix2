<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'system') == 'dark'])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        {{-- Inline script to detect system dark mode preference and apply it immediately --}}
        <script>
            (function() {
                const appearance = '{{ $appearance ?? "system" }}';

                if (appearance === 'system') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

                    if (prefersDark) {
                        document.documentElement.classList.add('dark');
                    }
                }
            })();
        </script>

        {{-- Inline style to set the HTML background color based on our theme in app.css --}}
        <style>
            html {
                background-color: oklch(1 0 0);
            }

            html.dark {
                background-color: oklch(0.145 0 0);
            }

            /* Loader styles */
            #app-loader {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                background-color: oklch(1 0 0);
                transition: opacity 0.3s ease-out;
            }

            html.dark #app-loader {
                background-color: oklch(0.145 0 0);
            }

            .app-loader-spinner {
                width: 50px;
                height: 50px;
                border-radius: 50%;
                border: 3px solid rgba(255, 32, 86, 0.3);
                border-top-color: rgb(255, 32, 86);
                animation: spinner 1s infinite linear;
            }

            @keyframes spinner {
                to {
                    transform: rotate(360deg);
                }
            }
        </style>

        <title inertia>{{ config('app.name', 'Laravel') }}</title>

        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600" rel="stylesheet" />

        @routes
        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased scrollbar">
        <!-- Initial loader that shows before React/Inertia initializes -->
        <div id="app-loader">
            <div class="app-loader-spinner"></div>
        </div>

        <!-- Script to hide the loader after React/Inertia has initialized -->
        <script>
            document.addEventListener('DOMContentLoaded', function() {
                // Wait a small amount to ensure the initial React rendering has started
                setTimeout(function() {
                    // Hide the loader once Inertia has initialized
                    const observer = new MutationObserver(function(mutations) {
                        if (document.getElementById('app')) {
                            const loader = document.getElementById('app-loader');
                            if (loader) {
                                loader.style.opacity = '0';
                                setTimeout(function() {
                                    loader.style.display = 'none';
                                }, 300);
                            }
                            observer.disconnect();
                        }
                    });
                    
                    observer.observe(document.body, { childList: true, subtree: true });
                }, 100);
            });
        </script>

        @inertia
    </body>
</html>
