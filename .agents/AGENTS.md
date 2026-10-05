# Context & Rules Memory (AGENTS.md)

## 1. AI Directives
> [!IMPORTANT]
> **CRITICAL**: Always read this file before suggesting code changes, modifying architecture, or debugging. Keep all styling premium and ensure compatibility with the current architecture (Next.js/React full-stack application running on 100% pure InnerTube.js).

---

## 2. Project Overview
* **Application Name**: MultiChat Website (Live YouTube Chat & Moderation Dashboard).
* **Purpose**: A real-time live chat streaming and moderation dashboard for content creators and streamers. It connects directly to live broadcasts without browser extensions, renders live messages and moderation events in real time, and allows chat actions (sending, deleting, timing out, banning, moderator management) using 100% pure InnerTube.js.
* **Repository Layout**:
  * `/app`: Next.js 16 App Router (Core API routes `/api/youtube/innertube`, `/api/youtube/chat`, `/api/youtube/callback`, and authentication pages).
  * `/multichat`: Core dashboard components (`ChatDashboard.jsx`, `ChatFeed.jsx`, `ChatInput.jsx`) and client utilities (`youtubeChat.js`).
  * `/components`: Shadcn, Radix UI, Framer Motion, and Lucide React UI components.
  * `/lib`: Backend utilities (`innertubeSession.ts`, `supabase.ts`).
  * `/BackEnd` & `/FrontEnd`: Inactive legacy archives from the original StreamClips Hub / clip-saver prototype. **NOT used or imported by the active Next.js website**.

---

## 3. Tech Stack & Architecture
* **Frontend**:
  * Next.js 16, React 19, Tailwind CSS, Lucide React, Framer Motion.
  * Real-time YouTube live chat streaming via `multichat/utils/youtubeChat.js`.
* **Backend Engine (100% Pure InnerTube.js)**:
  * Runtime: Next.js API Routes (`app/api/youtube/innertube/route.ts`).
  * YouTube Engine: `youtubei.js` (InnerTube). **Zero dependency on YouTube Data API v3**.
  * Moderation Actions: Direct InnerTube RPC endpoints (`live_chat/moderate`, `live_chat/manage_user`) signed with authenticated session cookies.
  * Channel Metadata: Resolved via InnerTube `resolveURL` and `getChannel`.
* **Database**: Supabase PostgreSQL client integration.

---

## 4. Current Database Schema
The Supabase database consists of the following key tables:

### `profiles`
Represents registered stream creators.
* `id`: UUID (Primary Key)
* `channel_id`: `VARCHAR(24)` (Unique YouTube Channel ID, e.g. starts with `UC`)
* `channel_name`: `TEXT`
* `avatar_url`: `TEXT`
* `total_views`: `BIGINT`
* `subscribers`: `BIGINT`
* `is_special`: `BOOLEAN` (Highlights partner status)

### `streams`
Tracks broadcast data.
* `video_id`: `VARCHAR(11)` (Primary Key, YouTube Video ID)
* `video_title`: `TEXT`
* `storyboard_spec`: `TEXT` (Specification for video thumbnails/frames)

### `games`
Normalizes video games tagged in streams.
* `id`: `VARCHAR(50)` (Primary Key, slug format e.g. `call-of-duty-mobile`)
* `game_title`: `TEXT`
* `game_poster`: `TEXT`

### `clips`
Stores the clipped stream highlights.
* `id`: BIGSERIAL / UUID (Primary Key)
* `video_id`: `VARCHAR(11)` (References `streams.video_id`)
* `timestamp_seconds`: `INT`
* `description`: `VARCHAR(200)` (Clipper tag or notes)
* `username`: `TEXT` (Viewer who created the clip)
* `user_role`: `VARCHAR(20)` (`owner`, `moderator`, `subscriber`, `regular`, `everyone`)
* `profile_id`: UUID (References `profiles.id`)
* `game_id_tag`: `VARCHAR(50)` (References `games.id`)
* `is_hidden`: `BOOLEAN` (Allows creators to moderate clips)
* `is_favorite`: `BOOLEAN` (Protects clip from auto-cleanup)
* `created_at`: `TIMESTAMP`

---

## 5. UI/UX Guidelines
* **Theme & Vibe**: Rich, premium dark mode aesthetic with glassmorphism/glass effects (`backdrop-filter: blur(16px)`).
* **Color Scheme**: Deep slate/dark background (`rgba(10, 11, 20, 0.8)`), purple accent colors, emerald details for success badges, and amber for warning elements.
* **Unified Visual Style**: Ensure cards, buttons, and popups preserve the dark-mode theme color constraints even if a general light/day mode is toggled, protecting the premium dark gaming theme.
* **Performance Rendering**: Keep background glows composite-promoted using `will-change: transform` and `translate3d` to prevent GPU frame drops on layout transitions.

---

## 6. Current Status & Active Bugs
* **Implemented**:
  * **Video Scrubbing**: Silent preloading, instant rendering of Frame 0, and wide 16:9 canvas vignette blending.
  * **API Pipelines**: Full Nightbot API integration with spam prevention, live check latency buffers, and database saves.
  * **Database RLS Policies**: Public read on games, profile syncs, and clip edits.
* **Next Steps**:
  * Transitioning layout elements to Next.js/React.
  * Connecting frontend search actions to backend tag indexes.
  * Refining responsive grid breakpoints on the live dashboard.
