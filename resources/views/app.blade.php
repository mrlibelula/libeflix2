<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'system') == 'dark'])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

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

        {{-- favicon --}}
        <link rel="icon" href="{{ asset('/images/libeflix-web-icon.webp') }}" type="image/png">

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
                flex-direction: column;
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
                margin-bottom: 20px;
            }

            .app-loader-logo {
                display: flex;
                align-items: center;
                margin-top: 10px;
                margin-bottom: 2rem;
            }

            .app-loader-logo-icon {
                /* background-color: rgb(255, 32, 86); */
                color: white;
                width: 40px;
                height: 40px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .app-loader-logo-text {
                margin-left: 10px;
                margin-bottom: 1.5rem;
                font-weight: 600;
                font-size: 18px;
                color: rgb(23, 23, 23);
            }

            html.dark .app-loader-logo-text {
                color: rgb(229, 229, 229);
            }

            html.dark .app-loader-logo-icon svg {
                fill: black;
            }

            .app-loader-image-container {
                margin-bottom: 0.5rem;
                width: 2rem;
                height: 2rem;
            }

            .app-loader-image {
                width: 2.5rem;
                height: 2.5rem;
                object-fit: contain;
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
            {{-- <div class="app-loader-logo">
                <div class="app-loader-logo-icon">
                    <svg viewBox="0 0 40 42" xmlns="http://www.w3.org/2000/svg" style="width: 24px; height: 24px; fill: currentColor;">
                        <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M17.2 5.63325L8.6 0.855469L0 5.63325V32.1434L16.2 41.1434L32.4 32.1434V23.699L40 19.4767V9.85547L31.4 5.07769L22.8 9.85547V18.2999L17.2 21.411V5.63325ZM38 18.2999L32.4 21.411V15.2545L38 12.1434V18.2999ZM36.9409 10.4439L31.4 13.5221L25.8591 10.4439L31.4 7.36561L36.9409 10.4439ZM24.8 18.2999V12.1434L30.4 15.2545V21.411L24.8 18.2999ZM23.8 20.0323L29.3409 23.1105L16.2 30.411L10.6591 27.3328L23.8 20.0323ZM7.6 27.9212L15.2 32.1434V38.2999L2 30.9666V7.92116L7.6 11.0323V27.9212ZM8.6 9.29991L3.05913 6.22165L8.6 3.14339L14.1409 6.22165L8.6 9.29991ZM30.4 24.8101L17.2 32.1434V38.2999L30.4 30.9666V24.8101ZM9.6 11.0323L15.2 7.92117V22.5221L9.6 25.6333V11.0323Z"
                        />
                    </svg>
                </div>
            </div> --}}
            {{-- <div class="app-loader-image-container">
                <img src="/images/libeflix-web-icon.webp" alt="StreamLab" class="app-loader-image" />
            </div> --}}
            {{-- <div class="app-loader-logo-text">StreamLab</div> --}}
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
