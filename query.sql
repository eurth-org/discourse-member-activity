-- [params]
-- int :days = 90
-- string :rp_category_ids = 17,18,19,20,21,22

-- Member activity: everyone who posted or was seen in the last :days days,
-- with when they last posted anywhere and when they last posted in an RP
-- category (the listed categories and their subcategories).
-- Counts regular posts in regular topics only: no private messages, small
-- actions, whispers or deleted posts. Used by the Member Activity theme
-- component. Keep the column names as they are.

WITH rp AS (
  SELECT c.id
  FROM categories c
  WHERE c.id = ANY (string_to_array(NULLIF(:rp_category_ids, ''), ',')::int[])
     OR c.parent_category_id = ANY (string_to_array(NULLIF(:rp_category_ids, ''), ',')::int[])
),
since AS (
  SELECT CURRENT_TIMESTAMP - (:days * INTERVAL '1 day') AS cutoff
),
last_posts AS (
  SELECT
    p.user_id,
    MAX(p.created_at) AS last_posted_at,
    MAX(p.created_at) FILTER (WHERE t.category_id IN (SELECT id FROM rp)) AS last_rp_posted_at,
    COUNT(*) FILTER (WHERE p.created_at >= (SELECT cutoff FROM since)) AS posts,
    COUNT(*) FILTER (WHERE p.created_at >= (SELECT cutoff FROM since)
                       AND t.category_id IN (SELECT id FROM rp)) AS rp_posts
  FROM posts p
  JOIN topics t ON t.id = p.topic_id
  WHERE p.deleted_at IS NULL
    AND t.deleted_at IS NULL
    AND t.archetype = 'regular'
    AND p.post_type = 1
    AND p.user_id > 0
  GROUP BY p.user_id
)
SELECT
  u.id AS user_id,
  u.last_seen_at,
  lp.last_posted_at,
  lp.last_rp_posted_at,
  COALESCE(lp.posts, 0) AS posts,
  COALESCE(lp.rp_posts, 0) AS rp_posts
FROM users u
LEFT JOIN last_posts lp ON lp.user_id = u.id
WHERE u.id > 0
  AND u.active
  AND NOT u.staged
  AND (u.last_seen_at >= (SELECT cutoff FROM since)
       OR lp.last_posted_at >= (SELECT cutoff FROM since))
ORDER BY lp.last_posted_at DESC NULLS LAST
