// Member Activity chart. Plain DOM, no framework, so it can be tested on its
// own: renderMemberActivity(host, { load, defaultMonths, maxMonths }).
//
// load(days) resolves to a Data Explorer result: columns, rows and
// relations.user. The bars count down: a member who posted today has the
// whole window left (a month counts as 30 days, so 3 months is 90 days), and
// one who posted 89 days ago has 1 day left before dropping off the list.

const DAY = 86400000;
const DAYS_PER_MONTH = 30;
const OVERDUE_CAP = 365; // the black bars are full width from a year past the limit

const VIEWS = [
  { id: "all", label: "All posts" },
  { id: "rp", label: "RP posts" },
  { id: "both", label: "Both" },
];

const SORTS = [
  { id: "left", label: "Most days left first" },
  { id: "risk", label: "Fewest days left first" },
  { id: "name", label: "Name" },
];

export function band(daysLeft) {
  if (daysLeft <= 7) return "red";
  if (daysLeft <= 14) return "orange";
  if (daysLeft <= 30) return "yellow";
  return "blue";
}

// Whole days since a moment: 0 for today (the last 24 hours), 1 for yesterday.
export function daysSince(iso, now) {
  if (!iso) return null;
  return Math.max(0, Math.floor((now - Date.parse(iso)) / DAY));
}

// Days left before a post falls out of a window of `days` days: from `days`
// (posted today) down to 1. Null when the post is outside the window.
export function daysLeft(iso, days, now) {
  const age = daysSince(iso, now);
  if (age === null) return null;
  const left = days - age;
  return left >= 1 ? left : null;
}

export function toMembers(result, days, now = Date.now()) {
  const col = Object.fromEntries(result.columns.map((c, i) => [c, i]));
  const users = new Map((result.relations?.user || []).map((u) => [u.id, u]));
  return result.rows.map((row) => {
    const id = row[col.user_id];
    const u = users.get(id) || { username: `user ${id}` };
    const lastPost = row[col.last_posted_at];
    const lastRp = row[col.last_rp_posted_at];
    return {
      id,
      username: u.username,
      name: u.name,
      avatar: u.avatar_template ? u.avatar_template.replace("{size}", "48") : null,
      lastSeen: row[col.last_seen_at],
      lastPost,
      lastRp,
      posts: row[col.posts] || 0,
      rpPosts: row[col.rp_posts] || 0,
      seenDays: daysSince(row[col.last_seen_at], now),
      postAge: daysSince(lastPost, now),
      rpAge: daysSince(lastRp, now),
      left: daysLeft(lastPost, days, now),
      rpLeft: daysLeft(lastRp, days, now),
    };
  });
}

// Who goes in the chart and who goes in the list below it, for one view.
export function split(members, view, days) {
  const metric = view === "rp" ? "rpLeft" : "left";
  const active = members.filter((m) =>
    view === "both" ? m.left !== null || m.rpLeft !== null : m[metric] !== null
  );
  const seen = (m) => m.seenDays !== null && m.seenDays < days;
  const idle = members.filter((m) => m[metric] === null && seen(m));
  return { active, idle };
}

function sortActive(list, sort, view) {
  const key = (m) => (view === "rp" ? m.rpLeft : m.left) ?? m.rpLeft ?? 0;
  const byName = (a, b) => a.username.localeCompare(b.username);
  const sorted = [...list];
  if (sort === "name") sorted.sort(byName);
  else if (sort === "risk") sorted.sort((a, b) => key(a) - key(b) || byName(a, b));
  else sorted.sort((a, b) => key(b) - key(a) || byName(a, b));
  return sorted;
}

// The list under the chart, most recent post first, like the chart. In the RP
// view: by last RP post, then (for those who never made one) by last post of
// any kind, then by last seen. "Fewest days left first" turns it around.
export function sortIdle(list, view, sort = "left") {
  const keys = view === "rp" ? ["rpAge", "postAge", "seenDays"] : ["postAge", "seenDays"];
  const byName = (a, b) => a.username.localeCompare(b.username);
  if (sort === "name") return [...list].sort(byName);
  const dir = sort === "risk" ? -1 : 1;
  return [...list].sort((a, b) => {
    for (const k of keys) {
      const x = a[k], y = b[k];
      if (x === y) continue;
      if (x === null) return 1; // never: always last
      if (y === null) return -1;
      return (x - y) * dir;
    }
    return byName(a, b);
  });
}

// ---------------------------------------------------------------- formatting

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

function ago(d) {
  if (d === null) return "never";
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 60) return `${d} days ago`;
  if (d < 730) return `${Math.round(d / 30)} months ago`;
  return `${Math.floor(d / 365)} years ago`;
}

function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function periodLabel(months) {
  return `${plural(months, "month")} (${months * DAYS_PER_MONTH} days)`;
}

// ---------------------------------------------------------------- DOM helpers

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style") for (const [prop, val] of Object.entries(v)) el.style.setProperty(prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), val);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

function who(m) {
  return h(
    "a",
    { class: "ma-who", href: `/u/${encodeURIComponent(m.username)}/activity` },
    m.avatar ? h("img", { class: "ma-avatar", src: m.avatar, alt: "", width: 24, height: 24, loading: "lazy" }) : null,
    h("span", { class: "ma-name" }, m.username)
  );
}

function tooltip(m, days) {
  return [
    m.username,
    `last post: ${m.lastPost ? `${dateFmt.format(new Date(m.lastPost))} (${ago(m.postAge)})` : "never"}`,
    `last RP post: ${m.lastRp ? `${dateFmt.format(new Date(m.lastRp))} (${ago(m.rpAge)})` : "never"}`,
    `${plural(m.posts, "post")} in ${days} days, ${m.rpPosts} in RP`,
    `last seen: ${ago(m.seenDays)}`,
  ].join("\n");
}

function bar(left, days, kind) {
  const track = h("span", { class: "ma-track", "aria-hidden": "true" });
  if (left !== null) {
    track.append(
      h("span", {
        class: `ma-bar ma-bar--${band(left)}`,
        style: { width: `${(left / days) * 100}%` },
        "data-kind": kind,
      })
    );
  }
  return track;
}

function leftText(left, count, kind) {
  const tag = kind ? `${kind} ` : "";
  if (left === null) return `${tag}no post`;
  return `${tag}${plural(left, "day")} left · ${plural(count, "post")}`;
}

function axis(days) {
  const ticks = [...new Set([0, 7, 14, 30, ...[60, 90, 180, 270, 360, 540, 720].filter((t) => t < days), days])]
    .filter((t) => t <= days)
    .sort((a, b) => a - b);
  const scale = h("span", { class: "ma-axis-scale", "aria-hidden": "true" });
  // With a long window the 7, 14 and 30 marks crowd together: keep 30 and the end.
  const crowded = days > 180;
  for (const t of ticks) {
    if (crowded && (t === 7 || t === 14)) continue;
    scale.append(h("span", { class: "ma-tick", style: { left: `${(t / days) * 100}%` } }, t));
  }
  return h("div", { class: "ma-row ma-axis" }, h("span", { class: "ma-axis-title" }, "days left"), scale, h("span"));
}

// Where the colours change (30, 14 and 7 days left), as custom properties the
// tracks draw thin guide lines from.
function guideVars(days) {
  const at = (t) => `${(Math.min(t, days) / days) * 100}%`;
  return { "--ma-g30": at(30), "--ma-g14": at(14), "--ma-g7": at(7) };
}

function activeRow(m, view, days) {
  const title = tooltip(m, days);
  if (view === "both") {
    return h(
      "li",
      { class: "ma-row ma-row--both", title },
      who(m),
      h("span", { class: "ma-pair" }, bar(m.left, days, "all"), bar(m.rpLeft, days, "rp")),
      h(
        "span",
        { class: "ma-label" },
        h("span", {}, leftText(m.left, m.posts, "All:")),
        h("span", {}, leftText(m.rpLeft, m.rpPosts, "RP:"))
      )
    );
  }
  const left = view === "rp" ? m.rpLeft : m.left;
  const count = view === "rp" ? m.rpPosts : m.posts;
  return h("li", { class: "ma-row", title }, who(m), bar(left, days, view), h("span", { class: "ma-label" }, leftText(left, count)));
}

function idleRow(m, view, days) {
  const age = view === "rp" ? m.rpAge : m.postAge;
  const last = view === "rp" ? m.lastRp : m.lastPost;
  const over = age === null ? OVERDUE_CAP : Math.min(OVERDUE_CAP, age - days);
  const what = view === "rp" ? "RP post" : "post";
  const first = age === null ? `never made ${view === "rp" ? "an RP post" : "a post"}` : `${plural(age - days, "day")} over`;
  // Someone who never made an RP post may still have posted out of character.
  const fallback = view === "rp" && m.lastPost ? `last post ${dateFmt.format(new Date(m.lastPost))} · ` : "";
  const second =
    age === null
      ? `${fallback}seen ${ago(m.seenDays)}`
      : `last ${what} ${dateFmt.format(new Date(last))} · seen ${ago(m.seenDays)}`;
  return h(
    "li",
    { class: "ma-row ma-row--idle", title: tooltip(m, days) },
    who(m),
    h(
      "span",
      { class: "ma-track ma-track--neg", "aria-hidden": "true" },
      h("span", { class: "ma-bar ma-bar--black", style: { width: `${(Math.max(over, 1) / OVERDUE_CAP) * 100}%` } })
    ),
    h("span", { class: "ma-label" }, h("span", {}, first), h("span", { class: "ma-seen" }, second))
  );
}

function idleAxis() {
  const scale = h("span", { class: "ma-axis-scale ma-axis-scale--neg", "aria-hidden": "true" });
  for (const t of [0, 90, 180, 270, 365]) {
    scale.append(h("span", { class: "ma-tick", style: { right: `${(t / OVERDUE_CAP) * 100}%` } }, t === 365 ? "365+" : t));
  }
  return h("div", { class: "ma-row ma-axis" }, h("span", { class: "ma-axis-title" }, "days over"), scale, h("span"));
}

function legend() {
  const items = [
    ["blue", "more than 30 days left"],
    ["yellow", "30 days or fewer"],
    ["orange", "14 days or fewer"],
    ["red", "7 days or fewer"],
  ];
  return h(
    "ul",
    { class: "ma-legend", "aria-label": "Colours" },
    items.map(([c, t]) => h("li", {}, h("span", { class: `ma-swatch ma-bar--${c}`, "aria-hidden": "true" }), t))
  );
}

// ---------------------------------------------------------------- the widget

export function renderMemberActivity(host, { load, defaultMonths = 3, maxMonths = 24 }) {
  const state = { months: defaultMonths, view: "all", sort: "left", result: null, error: null, loading: false };
  const cache = new Map();

  host.classList.add("ma");
  host.replaceChildren();

  const minus = h("button", { type: "button", class: "btn btn-default ma-step", "aria-label": "One month shorter", onclick: () => setMonths(state.months - 1) }, "−");
  const plus = h("button", { type: "button", class: "btn btn-default ma-step", "aria-label": "One month longer", onclick: () => setMonths(state.months + 1) }, "+");
  const period = h("output", { class: "ma-period-value", "aria-live": "polite" });
  const viewButtons = VIEWS.map((v) =>
    h("button", { type: "button", class: "btn ma-view", "data-view": v.id, onclick: () => { state.view = v.id; draw(); } }, v.label)
  );
  const sortSelect = h(
    "select",
    { class: "ma-sort", onchange: (e) => { state.sort = e.target.value; draw(); } },
    SORTS.map((s) => h("option", { value: s.id }, s.label))
  );

  const toolbar = h(
    "div",
    { class: "ma-toolbar" },
    h("div", { class: "ma-period", role: "group", "aria-label": "Period" }, h("span", { class: "ma-caption" }, "Period"), minus, period, plus),
    h("div", { class: "ma-views", role: "group", "aria-label": "View" }, viewButtons),
    h("label", { class: "ma-sort-label" }, h("span", { class: "ma-caption" }, "Sort"), sortSelect)
  );
  const body = h("div", { class: "ma-body" });
  host.append(toolbar, body);

  function setMonths(n) {
    state.months = Math.min(maxMonths, Math.max(1, n));
    fetchData();
  }

  async function fetchData() {
    const days = state.months * DAYS_PER_MONTH;
    state.error = null;
    if (cache.has(days)) {
      state.result = cache.get(days);
      return draw();
    }
    state.loading = true;
    draw();
    try {
      const result = await load(days);
      if (result.errors?.length) throw new Error(result.errors.join(" "));
      cache.set(days, result);
      if (days === state.months * DAYS_PER_MONTH) state.result = result;
    } catch (e) {
      state.error = e?.jqXHR?.responseJSON?.errors?.join(" ") || e?.message || String(e);
    } finally {
      state.loading = false;
      draw();
    }
  }

  function draw() {
    const days = state.months * DAYS_PER_MONTH;
    period.textContent = periodLabel(state.months);
    minus.disabled = state.months <= 1;
    plus.disabled = state.months >= maxMonths;
    for (const b of viewButtons) {
      const on = b.dataset.view === state.view;
      b.setAttribute("aria-pressed", String(on));
      b.classList.toggle("btn-primary", on);
      b.classList.toggle("btn-default", !on);
    }
    sortSelect.value = state.sort;
    host.classList.toggle("ma--loading", state.loading);

    if (state.error) {
      body.replaceChildren(h("p", { class: "ma-error" }, `Couldn't load member activity: ${state.error}`));
      return;
    }
    if (!state.result) {
      body.replaceChildren(h("p", { class: "ma-note" }, "Loading member activity…"));
      return;
    }
    // While another period loads, keep showing the last result.
    const shownDays = state.result.params?.days ? Number(state.result.params.days) : days;
    const members = toMembers(state.result, shownDays);
    const { active, idle } = split(members, state.view, shownDays);
    const rpCount = members.filter((m) => m.rpLeft !== null).length;
    const allCount = members.filter((m) => m.left !== null).length;

    const heading = {
      all: `Posted in the last ${shownDays} days`,
      rp: `Posted in an RP category in the last ${shownDays} days`,
      both: `Posted in the last ${shownDays} days: all posts and RP posts`,
    }[state.view];
    const idleHeading =
      state.view === "rp"
        ? `Active, but no RP post in ${shownDays} days`
        : `Seen, but no post in ${shownDays} days`;
    const idleNote =
      state.view === "rp"
        ? "Seen on the forum in this period, without an RP post in it. Some of them posted out of character."
        : "Seen on the forum in this period, without a post in it.";

    const chart = h(
      "div",
      { class: "ma-chart", style: guideVars(shownDays) },
      axis(shownDays),
      h("ol", { class: "ma-rows" }, sortActive(active, state.sort, state.view).map((m) => activeRow(m, state.view, shownDays)))
    );

    body.replaceChildren(
      h(
        "p",
        { class: "ma-summary" },
        `${plural(allCount, "member")} posted in the last ${shownDays} days, ${rpCount} of them in RP. ` +
          `${plural(members.filter((m) => m.left === null).length, "more member was", "more members were")} seen without posting.`
      ),
      legend(),
      h("h3", { class: "ma-heading" }, `${heading} (${active.length})`),
      active.length ? chart : h("p", { class: "ma-note" }, "Nobody yet."),
      h("h3", { class: "ma-heading ma-heading--idle" }, `${idleHeading} (${idle.length})`),
      h("p", { class: "ma-note" }, idleNote),
      idle.length
        ? h("div", { class: "ma-chart ma-chart--idle" }, idleAxis(), h("ol", { class: "ma-rows" }, sortIdle(idle, state.view === "rp" ? "rp" : "all", state.sort).map((m) => idleRow(m, state.view === "rp" ? "rp" : "all", shownDays))))
        : h("p", { class: "ma-note" }, "Nobody.")
    );
  }

  fetchData();
}
