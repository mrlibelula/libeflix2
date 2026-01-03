# App Process Flows

Mermaid diagrams summarizing primary flows: browsing/streaming, subscription lifecycle, user interactions, and admin operations.

```mermaid
%%{init: {'theme':'dark','themeVariables': { 'primaryColor': '#1f2937', 'primaryTextColor': '#e5e7eb', 'primaryBorderColor': '#4b5563', 'lineColor': '#9ca3af', 'secondaryColor': '#111827', 'tertiaryColor': '#0b1220' }}}%%
flowchart TD
    subgraph Public [Public and Auth Users]
        A[Landing pages: home, movies, tvshows] --> B[View detail page]
        B --> C{is_free?}
        C -- Yes --> S[Stream free asset]
        C -- No --> D{Authenticated?}
        D -- No --> L[Login / Register]
        L --> D
        D -- Yes --> E{Active subscription?}
        E -- Yes --> P[Stream premium asset via signed URL]
        E -- No --> F[Select plan subscription/plans]
        F --> G[Checkout with Stripe Elements]
        G --> H[Stripe webhook triggers Cashier activation]
        H --> P
    end

    subgraph UserFeatures [Engagement]
        P --> W[Track watch progress and view count]
        P --> WL[Add or Remove Watch Later]
        P --> LK[Like or Unlike content]
        P --> CM[Comment if enabled]
    end

    subgraph Admin [Admin and Editor]
        AD[Admin login - admin or editor] --> DASH[Admin dashboard]
        DASH --> MC[Manage movies, TV shows, episodes]
        DASH --> MS[Manage subscription plans and user subs]
        DASH --> MU[Manage users, roles, permissions]
        DASH --> AN[Analytics and reports]
        DASH --> CFG[Site settings and moderation]
    end

    style Public fill:#111827,stroke:#4b5563,stroke-width:1.5px,color:#e5e7eb
    style UserFeatures fill:#0f172a,stroke:#4ade80,stroke-width:1.5px,color:#e5e7eb
    style Admin fill:#171717,stroke:#f87171,stroke-width:1.5px,color:#e5e7eb
```

Use this as a prompt-ready overview of how users, subscriptions, content access, and admin functions flow through the app.
