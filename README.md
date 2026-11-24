# Member Activity

A Discourse theme component for [Eurth](https://eurth.org) that shows staff who is active, as a horizontal bar chart inside a staff-only topic.

What's planned and what each release added is in the [roadmap](roadmap.md).

## What it shows

- **Who posted in the period** (3 months, or 90 days, unless you change it with − and +; a month counts as 30 days). Each member's bar counts down: someone who posted today has the whole period left, someone who posted 89 days ago has 1 day left before dropping off the list.
- **Three views**: all posts, posts in the RP categories, or both side by side (the RP bar is the striped one).
- **Colours**: Eurth blue, turning yellow at 30 days left, orange at 14 and red at 7. Thin lines on the tracks mark where the colours change.
- **Under the chart**: members seen on the forum in the period who didn't post in it, with a black bar growing left for how far past the limit they are (full width from a year over, or if they never posted). In the RP view this list is everyone active without an RP post.
- Point at a row for the member's last post, last RP post, post counts and when they were last seen.

Posts count when they are regular posts in regular topics: no private messages, small actions, whispers or deleted posts.

## How it works

- The numbers come from the Data Explorer query **Member activity** ([`query.sql`](query.sql)), shared with the staff group. The chart runs it through `/g/staff/reports/<id>/run`, so moderators who aren't admins can see it too.
- The component draws the chart wherever a post contains:

  ```
  [wrap=member-activity][/wrap]
  ```

  Put that in a topic in a staff-only category (Moderation). Anyone who isn't staff sees a short note instead, and the query refuses them anyway.
- The chart itself is plain DOM code in [`javascripts/discourse/lib/member-activity-chart.js`](javascripts/discourse/lib/member-activity-chart.js), so it can be tried on its own.

## Settings

| Setting | What it does | Default |
| --- | --- | --- |
| `query_id` | The Data Explorer query's id | `7` |
| `staff_group` | The group the query is shared with | `staff` |
| `rp_categories` | The RP categories; their subcategories count too | Affairs, Business, Conflict, Diplomacy, Entertainment, Future & Past |
| `default_months` | The period the chart opens on | `3` |
| `max_months` | The longest period the + button reaches | `24` |

## Install

1. In Data Explorer, create the query from `query.sql` and share it with the staff group. Note its id.
2. **Admin › Appearance › Themes › Install › From a git repository**, with this repository's URL. Add the component to every theme members can choose.
3. Set `query_id` (and check `rp_categories`) in the component's settings.
4. Post `[wrap=member-activity][/wrap]` in a staff-only topic.

## Releasing

Add the release's section to [roadmap.md](roadmap.md), commit, and push to `main`. Discourse checks for updates to git-installed components and shows **Update** in the admin.
