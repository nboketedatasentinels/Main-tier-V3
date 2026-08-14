# Course podcast assets (native in-app)

Source pack: `T4L-podcast-courses-for-dev` (Aug 2026).

## Layout

```
course-podcasts/
  BUILD-COMPLETE-MANIFEST.md
  T4L-C01/
    meta.json      # episode metadata + what_will_be_assessed + questions
    anchor.txt     # transcript (read)
    widener.txt
    challenger.txt
  T4L-C02/
  …
```

## How the app uses each file

| Asset | Use |
| --- | --- |
| `meta.json` → `url` | **Play** — open publisher episode (audio not hosted here yet) |
| `{slot}.txt` | **Read** — in-app transcript |
| `meta.json` → `what_will_be_assessed` + `questions` | **Grade** — open recall / application / challenge prompts (AI grading aligns with Nono’s compliance docs) |

## Course mapping

Catalogue slug → pack id is defined in `src/config/coursePodcastCatalogue.ts`.
Same pack applies for 6-week or 9-month journeys whenever that course is assigned.

## Holds / gaps

- **T4L-C13** (Data Sentinels): on hold — no folder.
- **T4L-C20** anchor: `UNFILLED` in meta — widener + challenger only.

## Cloud storage

Static files ship from Vite `public/` for now. When uploading to Supabase/Firebase storage, keep this folder shape (`{packId}/meta.json` + `{slot}.txt`) so paths stay stable.
