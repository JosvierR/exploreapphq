# Video Moderation Workspace

The admin Reports console opens to pending video reports by default. Moderators can filter to other report types, but video reports have a dedicated review drawer with video playback, report evidence, visibility context, related reports, and action history.

## Reviewing Video Reports

1. Open the admin Reports console.
2. Use the `Video Reports` tab or keep the default view.
3. Select `Review video` on a report row.
4. Review the video player, report reason/details, reporter, creator, metadata, related reports, and moderation history.
5. Choose a report decision or a global video visibility action.

## Report Status vs Video Visibility

`content_reports.status` tracks the report workflow:

- `pending`
- `reviewed`
- `dismissed`
- `removed`

`videos.moderation_status` tracks global video visibility:

- `active`
- `under_review`
- `hidden`
- `removed`

Marking a report reviewed does not hide the video. Dismissing a report does not hide the video. Global visibility actions update `videos.moderation_status` and create moderation audit records.

## Actions

- `Mark reviewed`: updates only the report case. The video remains visible unless a separate content action is taken.
- `Dismiss report`: dismisses the report. The video remains visible unless hidden separately.
- `Hide video globally`: sets `videos.moderation_status = hidden`.
- `Remove video globally`: sets `videos.moderation_status = removed`. The video is not hard-deleted.
- `Show video`: sets a hidden video back to `videos.moderation_status = active`.
- `Restore video`: sets a removed video back to `videos.moderation_status = active`.
- `Reopen report`: sets `content_reports.status = pending` without changing video visibility.

Reporting content only hides it for the reporting user through `user_hidden_content`.

## Full Lifecycle Controls

The drawer separates two lifecycle panels:

- Report case lifecycle: report status, decision, reviewer, reviewed time, last report action, and whether the case is open or closed.
- Video visibility lifecycle: publication state, `moderation_status`, public visibility, and reporter-specific hidden status.

Important rules:

- Reviewed does not mean the video is hidden.
- Dismissed does not mean the video is restored.
- Hidden and Removed affect everyone.
- Show video only changes global visibility back to active; users who personally hid the video may still not see it.

## Recovery

After a successful moderation action, the workspace shows a recovery action when safe:

- Hide video -> Show video
- Remove video -> Restore video
- Show/Restore video -> Hide video
- Mark reviewed -> Reopen report
- Dismiss report -> Reopen report

Reviewed and dismissed reports remain viewable. They can still be reopened, and video visibility actions remain available based on the video `moderation_status`.

## Video Preview

The admin API returns a playable `target.video_url` only when the stored URL is already public. Non-public storage paths are not exposed to the browser. If the video cannot be loaded, the drawer shows an unavailable state and keeps the public fallback link available.

If private storage playback is needed later, generate a short-lived signed URL server-side and never store it as permanent report data.

## If Video Cannot Load

Check whether:

- the target video still exists,
- `videos.video_url` is public or requires signed URL support,
- `videos.thumbnail_url` is available for fallback context,
- the admin API response has `target.video_available = false`.

## QA Checklist

Video report QA:

1. Open Reports.
2. Filter to Video.
3. Open a video report.
4. Confirm video preview loads.
5. Confirm report reason/details are visible.
6. Mark reviewed.
7. Confirm video remains visible.
8. Dismiss report.
9. Confirm video remains visible.
10. Hide video.
11. Confirm moderation_status becomes hidden.
12. Confirm normal users cannot see it.
13. Restore video.
14. Confirm moderation_status becomes active.
15. Remove video.
16. Confirm moderation_status becomes removed.
17. Confirm no hard delete happened.
18. Confirm moderation_actions records were created.

Full Lifecycle QA:

1. Open video report.
2. Mark reviewed.
3. Confirm video remains visible.
4. Confirm `Reopen report` appears.
5. Reopen report.
6. Confirm report becomes pending.
7. Hide video.
8. Confirm moderation_status = hidden.
9. Confirm `Show video` appears.
10. Click Show video.
11. Confirm moderation_status = active.
12. Remove video.
13. Confirm moderation_status = removed.
14. Confirm `Restore video` appears.
15. Restore video.
16. Confirm moderation_status = active.
17. Dismiss report.
18. Confirm Reopen report is available.
19. Confirm action timeline shows all actions.
20. Confirm no hard delete happened.
