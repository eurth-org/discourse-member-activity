import { apiInitializer } from "discourse/lib/api";
import { ajax } from "discourse/lib/ajax";
import { renderMemberActivity } from "../lib/member-activity-chart";

// Draws the chart wherever a post holds [wrap=member-activity][/wrap].
// Only staff see it: the numbers come from a Data Explorer query shared with
// the staff group, and everyone else sees a short note.
export default apiInitializer((api) => {
  const currentUser = api.getCurrentUser();

  api.decorateCookedElement(
    (element) => {
      const hosts = element.querySelectorAll('[data-wrap="member-activity"]');
      for (const host of hosts) {
        if (host.dataset.maReady) continue;
        host.dataset.maReady = "1";

        if (!currentUser?.staff) {
          host.textContent = "The member activity chart is for staff.";
          continue;
        }

        const rpCategoryIds = String(settings.rp_categories || "")
          .split("|")
          .filter(Boolean)
          .join(",");

        renderMemberActivity(host, {
          defaultMonths: settings.default_months,
          maxMonths: settings.max_months,
          load: (days) =>
            ajax(`/g/${encodeURIComponent(settings.staff_group)}/reports/${settings.query_id}/run`, {
              type: "POST",
              data: {
                params: JSON.stringify({
                  days: String(days),
                  rp_category_ids: rpCategoryIds,
                }),
              },
            }),
        });
      }
    },
    { id: "member-activity" }
  );
});
