# NiAngelos Ideation Session — Facilitation Guide

## 1. Preparation

### Problem Framing Review
NiAngelos is a Coptic Orthodox hymn school management platform serving multiple stakeholders: administrators, servants (teachers), parents, and students. Current capabilities include attendance tracking with behavior/participation/liturgy scoring, a points/gamification system (XP, levels, badges, leaderboard), assessments and grades, parent dashboards, and church-level multi-school support.

**Core tension:** How do we serve the spiritual formation mission (teaching hymns and Coptic traditions) while keeping servants and students engaged through technology that feels modern and delightful, not bureaucratic?

### Success Criteria for Ideas
- **Delightful** — Makes someone smile or feel seen
- **Lightweight** — Takes less than 30 seconds for a servant to use
- **Spiritually resonant** — Connects to Coptic tradition, not generic
- **Actionable** — Can be prototyped in a single sprint (1-2 weeks)
- **Measurable** — We can tell if it worked (engagement, retention, feedback)

### Constraints
- Single part-time developer (you)
- Servants are volunteers with limited tech comfort
- Mobile-first — most usage will be on phones during church
- Offline resilience needed (church basements have spotty signal)
- Privacy — student data, especially liturgical participation, is sensitive
- Must work across iOS/Android/desktop via a PWA or web app
- Zero budget for paid APIs or services

### Participants
- **Minimum:** 1 (solo ideation — this guide works for a single person)
- **Ideal:** 3-6 (mix of servant, parent, and admin perspectives)
- **Maximum:** 8 (beyond this, breakout into pairs)

### Time Available
- **Full session:** 2.5-3 hours
- **Lite version:** 60-75 minutes (skip warm-ups, reduce Crazy 8s and SCAMPER)
- **Micro version:** 20-25 minutes (just reframing + brain dump + dot vote)

---

## 2. Problem Reframing — How Might We

Read each statement aloud. After reading all 15, circle back to the ones that spark energy. Add your own.

### Broad → Specific

1. **HMW** make checking attendance feel like a 5-second habit instead of data entry?
2. **HMW** help a servant remember every student's name, strengths, and struggles before they walk into class?
3. **HMW** turn a student's progress into something their grandparents can celebrate even if they don't speak English?
4. **HMW** make a parent feel genuinely connected to what their child is learning in church, not just notified?
5. **HMW** use the liturgy calendar to create natural rhythms of engagement (fasting seasons, feasts, saint days)?
6. **HMW** let a student see their own growth in a way that makes them proud without creating unhealthy competition?
7. **HMW** reward the quiet, consistent kid as visibly as the outgoing high-performer?
8. **HMW** help a new servant onboard in under 10 minutes without reading a manual?
9. **HMW** bridge the gap between what happens in the classroom and what happens in the sanctuary?
10. **HMW** make it fun and natural for students to teach each other (peer learning in a Coptic context)?
11. **HMW** give a busy priest or board member a 30-second pulse check on the health of the school?
12. **HMW** preserve the feeling of a close-knit church community even as the school scales across multiple locations?
13. **HMW** transform a student's worst subject (behavior, memorization, attendance) into their favorite challenge?
14. **HMW** use the platform to strengthen the connection between home and church, not replace it?
15. **HMW** make "I forgot my homework" the trigger for encouragement rather than a mark against the student?

### Quick Exercise (5 min)
Pick the **3 HMW statements that excite you most**. For each, write down one thing that would NOT be the solution (to bust assumptions):
> "How we might NOT solve this is ___"

---

## 3. Crazy 8s Exercise

### The Concept
Fold a sheet of paper into 8 rectangles. Set a timer for **8 minutes**. In each rectangle, sketch or write one distinct idea. One minute per box. No stopping early.

### How to Fold
```
┌─────┬─────┐
│  1  │  2  │
├─────┼─────┤
│  3  │  4  │
├─────┼─────┤
│  5  │  6  │
├─────┼─────┤
│  7  │  8  │
└─────┴─────┘
```
1. Fold paper in half vertically
2. Fold in half horizontally (4 panels)
3. Fold in half horizontally again (8 panels)

### Tips for Rapid Sketching
- Stick figures are fine. Stick figures with a halo? Even better.
- A box with a title and an arrow is a sketch.
- If you're stuck: write the title, draw a screen frame, add a single UI element.
- Use the HMW statements as prompts — pick your top 3 and iterate.
- **Quantity over quality.** The 8th idea is often the most original because your brain stops self-editing.

### No Idea Is Too Wild
- If you think "this is impossible with our tech" — write it anyway.
- If you think "the priest would never approve" — write it anyway.
- Write in Arabic if that's more natural.
- Use Coptic words if they capture the idea better.

---

## 4. Brainstorming Techniques

### 4a. Brain Dump
| | |
|---|---|
| **When** | Session opener — get ideas flowing before any structure |
| **How** | Set timer for 5 min. Each person writes **anything** that comes to mind on sticky notes. One idea per note. No talking, no deleting, no judging. Solo or silently in a group. |
| **Time** | 5 min generate + 5 min share |
| **Materials** | Sticky notes (3+ colors), pens |

### 4b. Round Robin
| | |
|---|---|
| **When** | After brain dump to get everyone contributing equally |
| **How** | Sit in a circle. Each person shares **one** idea in 30 seconds. Go around 3-4 rounds. Pass if you have nothing new. Feel free to riff on what the previous person said. |
| **Time** | 10-15 min (3 rounds × number of people × 30 sec) |
| **Materials** | Nothing — just the ideas from brain dump |

### 4c. Build on Ideas ("Yes, And")
| | |
|---|---|
| **When** | Session is flagging or ideas feel "safe" |
| **How** | Take one existing idea. First person says "Yes, and we could also __". Next person builds. No "but" allowed. Repeat 5-7 times per idea. Watch the idea mutate into something unexpected. |
| **Time** | 5-7 min per idea cluster |
| **Materials** | Whiteboard or large paper to capture the chain |

### 4d. Worst Possible Idea
| | |
|---|---|
| **When** | Team is perfectionist or stuck |
| **How** | "What's the **worst** way we could solve attendance tracking?" Write the most terrible, unusable, destructive ideas. Then reverse-engineer: what's the **opposite** of each terrible idea? That's often your best insight. |
| **Time** | 5 min generate worst + 5 min reverse |
| **Materials** | Sticky notes |

**Example:** Worst = "Require a 10-minute video upload from the parent proving the child was present." Reverse = "Let the parent confirm attendance with a single tap — no proof needed."

### 4e. SCAMPER
| | |
|---|---|
| **When** | You have a feature or flow you want to improve, not invent from scratch |
| **How** | Take one feature (e.g., "badge system"). Apply each lens: |
| | **S**ubstitute — What if we used Coptic icons instead of emoji? |
| | **C**ombine — What if badges were also calendar reminders for feasts? |
| | **A**dapt — What if badges adapted to the liturgical season? |
| | **M**odify — What if badges were physical stickers mailed home? |
| | **P**ut to other use — What if badges unlocked real-world privileges? |
| | **E**liminate — What if we removed all numeric scores, kept only badges? |
| | **R**everse — What if students awarded badges to servants? |
| **Time** | 3 min per lens (21 min for all 7) or 15 min for a quick pass |
| **Materials** | SCAMPER prompt card per person |

### 4f. Analogies
| | |
|---|---|
| **When** | Needing fresh perspective, late in the session |
| **How** | "How would Duolingo solve attendance?" "How would a Sunday School teacher from 1950 handle this?" "How would the Coptic Church's liturgical calendar design a gamification system?" Write the analogy, then extract principles. |
| **Time** | 10 min (3 analogies × 3 min each) |
| **Materials** | Analogy prompt list |

**Analogy prompts to try:**
- Duolingo (habit formation, streaks)
- Airbnb (trust, reviews between parents and servants)
- Apple Watch (micro-achievements, rings)
- Khan Academy (mastery-based progression)
- A physical hymn book (tactile, beautiful, permanent)
- A church potluck (community, sharing, belonging)

---

## 5. Divergent Thinking Prompts

Read each prompt. Spend **2-3 minutes per prompt** free-writing whatever comes to mind. Don't filter.

| Prompt | Twist |
|---|---|
| **No constraints** | Unlimited budget, unlimited time, unlimited dev team. What do you build? |
| **Start from scratch** | The platform doesn't exist. You're building it today for the first time. What's the first feature you launch? |
| **Do the opposite** | Everything we currently do — flip it. Attendance is optional. Grades are secret. Parents can't see anything. What emerges? |
| **Different persona** | Users are 8-year-olds who speak only Coptic. Or 80-year-old grandmothers. Or teenagers who don't want to be there. How does the experience change? |
| **Inspiring company** | What would Apple do? What would the Coptic Church's Synod design? What would a gamified children's liturgy app look like? |
| **No technology** | No screens, no apps, no internet. Only paper, physical objects, and face-to-face interaction. What's the best version of NiAngelos? |

---

## 6. Facilitation Tips

### Before the Session
- **Set the tone:** "This is a judgment-free zone. The goal is volume, not quality. We'll filter later."
- **Prime the brain:** Send the HMW statements 24 hours beforehand. Ask people to bring one "crazy" idea.
- **Physical setup:** Standing desks or no tables encourage energy. Sticky notes on walls beat sitting in chairs.

### During the Session
- **Defer judgment** — The number one rule. When someone shares, the only acceptable response is "Yes, and" or "Tell me more." No "but," "however," "we tried that."
- **Encourage wild ideas** — The wild ones unlock the practical ones. Explicitly reward the most unhinged idea in each round.
- **Build on others** — Every idea is a gift. Receive it, add to it, pass it forward.
- **Stay focused** — If the conversation drifts to implementation ("but the database schema..."), gently redirect: "Let's capture that concern and keep generating. We'll solve DB problems next week."
- **Go for quantity** — 100 ideas is a good target for a 3-hour session. 200 is better.
- **Use visual aids** — Sketching, diagrams, stick figures. A picture stores more nuance than words.

### Energy Management
- **First 30 min:** High energy, divergent, no criticism allowed
- **30-60 min:** Keep going, introduce SCAMPER or analogies to shake things up
- **60-90 min:** Natural dip — stand up, do a warm-up, switch to round robin
- **90-120 min:** Convergent thinking begins — clustering, dot voting
- **120-150 min:** Select winners, rough action plans

### Solo Ideation Adaptation
- **Talk to yourself** — Literally say ideas out loud. Record voice memos.
- **Change locations** — Move from desk to couch to coffee shop to park bench.
- **Use forced constraints** — "I must sketch 8 ideas in 8 minutes. No erasing."
- **Come back tomorrow** — Your unconscious brain processes overnight. Review your notes fresh.

---

## 7. Idea Capture

### How to Document
- **Sticky notes** — One idea per note. Use color coding: Blue = parent-facing, Yellow = servant-facing, Green = student-facing, Pink = admin/spiritual.
- **Digital fallback:** Miro board, Notion, FigJam, or even a shared Google Doc. But physical is faster and more tactile.
- **Voice memos** — Great for solo ideation. Speak ideas, transcribe later.
- **Photos** — End of session, photograph every sticky note wall before they fall off.

### What to Capture
- **Title** (3-8 words, specific)
- **Brief description** (1-2 sentences)
- **Who it's for** (servant, parent, student, admin)
- **Sketch** if visual (a screen layout, a flow, an interaction)
- **Pain point it addresses** (optional but helpful)

### Number Each Idea
```
IDEA #037 — "Saint of the Week" profile
For: Students
What: Each week a different student gets a spotlight profile.
Servant writes 3 nice things about them, posts a photo.
Parent sees it. Grandparent sees it. Kid feels like a million bucks.
```

---

## 8. Warm-Up Exercises

Do one or two of these before diving into ideas. Keep it loose and playful. No more than 5 minutes each.

### 8a. Draw Your Worst Idea
Set timer for **3 minutes**. Draw the worst possible feature for NiAngelos. Must be terrible. Share and laugh.

*Example: "A popup that appears every 30 seconds asking ARE YOU ENJOYING THIS? with a mandatory 5-star rating."*

### 8b. 30 Uses for a Paperclip
Set timer for **2 minutes**. List 30 uses for a paperclip. Doesn't have to be realistic. Gets your brain in "quantity mode."

### 8c. Mash-Up
Pick two random things. Mash them into a NiAngelos feature. **2 minutes.**

*Examples: "Liturgical incense + push notifications" → "A notification that sends a blessing scent quote when a student hits a streak." "Harp + QR codes" → "Scan a QR code in class to hear the hymn the students are learning."*

### 8d. Redesign Everyday Objects
**2 minutes.** Redesign something mundane (spoon, cross, keychain, church candle holder) to be better. Transfers to product thinking.

---

## 9. Time Management

### Full Session (3 hours)

| Time | Activity | Duration |
|---|---|---|
| 0:00 | Setup + warm-up (worst idea drawing) | 10 min |
| 0:10 | Problem framing review + read HMWs | 15 min |
| 0:25 | Pick top 3 HMWs + bust assumptions | 5 min |
| 0:30 | Brain dump (individual) | 10 min |
| 0:40 | Round robin sharing | 15 min |
| 0:55 | **Crazy 8s** | 12 min (8 min sketch + 4 min share) |
| 1:07 | "Yes, And" on 3 strongest Crazy 8 ideas | 15 min |
| 1:22 | **Break** (stand, stretch, hydrate) | 10 min |
| 1:32 | SCAMPER on one core feature | 15 min |
| 1:47 | Analogies (2-3 rounds) | 10 min |
| 1:57 | Divergent prompts (2 prompts) | 10 min |
| 2:07 | **Cluster + affinity map** all ideas | 20 min |
| 2:27 | Dot vote (3 votes per person) | 10 min |
| 2:37 | Discuss top 5 ideas + next steps | 15 min |
| 2:52 | Wrap-up + capture photos | 8 min |

### Lite Session (75 min)

| Time | Activity | Duration |
|---|---|---|
| 0:00 | Warm-up (paperclip) | 3 min |
| 0:03 | Read HMWs — pick top 5 | 10 min |
| 0:13 | Brain dump | 8 min |
| 0:21 | Crazy 8s (4 min version — fold paper in 4) | 8 min |
| 0:29 | Round robin | 12 min |
| 0:41 | "Yes, And" on top 2 ideas | 10 min |
| 0:51 | Cluster + dot vote | 14 min |
| 1:05 | Top 3 ideas + action plan | 10 min |

### When to Move On vs. Dig Deeper
- **Move on if:** Energy is dropping, people are repeating themselves, or every idea sounds similar.
- **Dig deeper if:** A specific HMW keeps sparking excited conversation, someone has a half-formed idea they're struggling to articulate, or the room goes quiet (that's thinking, not stuck).

---

## 10. Next Steps After Ideation

### Review and Cluster (20-30 min)
1. Spread all sticky notes on a wall or table.
2. Read every idea aloud (or silently if solo).
3. Group them into themes without talking:
   - **Attendance & engagement**
   - **Parent communication**
   - **Spiritual formation**
   - **Servant tools & workflow**
   - **Gamification & motivation**
   - **Community & church connection**
   - **Admin & reporting**
4. Name each cluster with a sticky note header.

### Dot Voting
- Each person gets **3-5 dot stickers** (or marker dots).
- Vote silently for the ideas you think are **most impactful**.
- Can spread votes or put all on one idea.
- Count dots — top 5-10 ideas bubble up.

### Select Ideas to Develop Further
For the top 5 ideas, answer:
1. **Why this matters** — which HMW does it address?
2. **The simplest version** — what's the smallest thing we could build in 1-2 days?
3. **Who says this is a good idea?** — can we find 3 users to validate it?
4. **What do we need to learn first?** — one question to answer before building.

### Combine and Refine
- Look for ideas that naturally pair or stack.
- *Example:* "Saint of the Week" + "Peer shout-out badges" → A combined feature where students nominate each other for recognition, spotlighted weekly.
- Merge similar ideas. Kill duplicates. Keep the orphans — they might be the most innovative.

### Action Plan Template
| Idea | MVP (1-2 days) | Validation needed | Owner | Target |
|---|---|---|---|---|
| Saint of the Week | Profile card on parent dashboard | Ask 3 parents if they'd check it | — | Next sprint |
| Quick-attendance by photo grid | Servant taps face photos to mark present | Test with 1 servant during rehearsal | — | This Sunday |
| Liturgy season badges | Auto-award badges tied to feast calendar | Verify calendar data accuracy | — | Before Kiahk |

### Archive Everything
- Save photos of the wall. Save the sticky notes (or recreate in Miro).
- The ideas that didn't win today might be perfect in 6 months.
- Share results with participants within 48 hours while energy is fresh.

---

> *"The best way to have a good idea is to have lots of ideas."* — Linus Pauling
>
> *Coptic tradition has always been participatory — the congregation doesn't just watch, they sing, they respond, they process. NiAngelos should feel the same way.*
