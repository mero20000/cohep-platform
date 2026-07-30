# Module 4 — Family & Parent Engagement Design

**Date:** 2026-07-30
**Status:** Approved for implementation

## Overview

Elevate parent portal from passive monitoring (2/10) to active family engagement (10/10) with three features: weekly practice guides with hymn audio, rich liturgical journey timeline with PDF export, and multi-child dashboard with one-tap audio playback.

## Data Model Changes

All existing infrastructure reused — no new models. Columns added to existing tables.

### Lesson

```prisma
audioUrl            String?   @map("audio_url")
audioOriginalName   String?   @map("audio_original_name")
audioDuration       Int?      @map("audio_duration")  // seconds
```

### LessonProgress

```prisma
milestonePhotoUrl   String?   @map("milestone_photo_url")
milestoneCaption    String?   @map("milestone_caption")  // servant's milestone note
```

Replaces the generic `notes` field for milestone context. Existing `notes` field kept for internal servant use.

### FamilyLiturgy

```prisma
photoUrl            String?   @map("photo_url")
servantNote         String?   @map("servant_note")
```

## 1. Audio Upload & Playback

### Backend

- Accept `.mp3`, `.m4a`, `.ogg` via existing `FileUploadService` → saved to `uploads/audio/`
- Lesson editor UI: new file input in the existing lesson edit page
- Allowed file types validated on both frontend (accept attribute) and backend (file type check)
- URL pattern: `{NEXT_PUBLIC_API_URL}/uploads/audio/{uuid}.{ext}`
- Existing Express static serving handles delivery

### Frontend

- Reusable `<AudioPlayer>` component: play/pause, seek, time display, volume
- Single-instance per page (stop current when starting new)
- Used in: multi-child dashboard, child detail page, practice guide page

## 2. Rich Journey Timeline

### Data Sources

Existing `GET /parents/me/children/:id/milestones` already combines:
- Completed `LessonProgress` records (with new `milestonePhotoUrl`, `milestoneCaption`)
- Verified `FamilyLiturgy` records (with new `photoUrl`, `servantNote`)
- Earned `StudentBadge` records

No new backend endpoint needed.

### Frontend Rendering

Vertical timeline with rich nodes, each showing:
- Type icon (lesson/book/liturgy/badge)
- Title + date
- Servant-uploaded photo (clickable for full-size lightbox)
- Servant note
- Badge icon if applicable

### PDF Export

- Client-side generation via `@react-pdf/renderer` (same approach as existing term report)
- Layout: child profile header → photo gallery spread → chronological timeline → stats summary
- Trigger: "Download Archive" button on child detail page (`/portal/children/[id]`)
- Filename: `{child-name}-formation-archive.pdf`

## 3. Multi-Child Dashboard with Audio

Page: existing `/portal` dashboard. No new route needed.

### Card Enhancements

Each `<ChildCard>` gains:
- Current hymn name beneath the child's name
- "Play Current Hymn" button — one tap plays the audio via shared `<AudioPlayer>`
- Button grayed with "No current lesson" if no active curriculum allocation

### Backend

`GET /parents/me/children` response extended with `currentLesson` object:
```json
{
  "currentLesson": {
    "id": "uuid",
    "name": "Doxology of the Virgin — First Verse",
    "nameAr": "...",
    "audioUrl": "/uploads/audio/xxx.mp3",
    "audioDuration": 90
  } | null
}
```

## 4. Weekly Practice Guide

Trigger: servant marks attendance session as complete (`PATCH /attendance/sessions/:id/complete`).

### Backend Flow

1. Session completes → iterate students marked `present`
2. For each student, find `StudentParent` links → resolve parent `User` records
3. Create notification per parent (in-app + push if subscribed):
   - `type: 'practice_guide'`
   - `title: "{student.firstName}'s practice guide for this week"`
   - `body: "{student.firstName} learned {lesson.hymnName} today."`
   - `data: { url: '/portal/children/{id}/practice-guide', lessonId: '...', audioUrl: '...', hymnName: '...' }`
4. Frontend notification panel renders inline audio card for `practice_guide` type notifications

### Practice Guide Page

Route: `/portal/children/[id]/practice-guide`
Layout:
- Hymn name (Coptic + Arabic + English)
- Audio player
- Lyrics/content from lesson model
- "Mark as practiced" button → calls `POST /parents/me/children/:id/practice`

## Implementation Order

1. **Schema migration** — add new columns to Lesson, LessonProgress, FamilyLiturgy
2. **Audio upload** — lesson editor file input + backend file handling
3. **AudioPlayer component** — reusable player
4. **Multi-child dashboard** — extend `/portal` cards with current lesson + audio, extend `getChildren()` response
5. **Rich timeline** — extend milestones endpoint to return new fields, re-render frontend timeline
6. **Weekly practice guide** — notification trigger in attendance service + practice guide page
7. **PDF export** — `@react-pdf/renderer` archive generation

## Excluded (Deferred)

- Father/confessor sharing (opt-in milestone sharing with spiritual father)
- Multi-track audio per lesson (melody + deacon + full)
- SMS notifications
