function escapeCsv(value: unknown) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsv(row[header])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function flattenBusinessOverview(data: any) {
  const summary = data?.summary || {};
  return [
    {
      period_start: data?.range?.start,
      period_end: data?.range?.end,
      active_users_estimate: summary.active_users_estimate,
      sessions: summary.active_sessions,
      app_opens: summary.app_opens,
      content_views: summary.content_views_total,
      searches: summary.searches_total,
      engagement_actions: summary.engagement_actions,
      rejected_events: summary.dead_letters_total,
    },
  ];
}

export function flattenGrowthSeries(data: any) {
  return (data?.series || []).map((row: any) => ({
    day: row.day,
    events: row.events,
    sessions: row.sessions,
    active_anonymous_ids: row.active_anonymous_ids,
    active_authenticated_users: row.active_authenticated_users,
    app_opens: row.app_opens,
    content_views: row.content_views,
  }));
}

export function flattenFunnel(data: any) {
  return (data?.funnel || []).map((row: any, index: number) => ({
    rank: index + 1,
    step: row.label,
    count: row.count,
    unique_sessions: row.unique_sessions,
    dropoff_percent: row.dropoff_pct,
  }));
}

export function flattenContentPerformance(data: any) {
  const sections = data?.sections || {};
  const rows: Array<Record<string, unknown>> = [];
  for (const [type, items] of Object.entries(sections)) {
    (items as any[]).forEach((item, index) => {
      rows.push({
        rank: index + 1,
        type,
        content_id: item.entity_id,
        views: item.views,
        likes: item.likes,
        saves: item.saves,
        shares: item.shares,
        reports: item.reports,
        engagement_score: item.engagement_score,
      });
    });
  }
  return rows;
}

export function flattenSearchInsights(data: any) {
  return (data?.breakdowns?.top_query_hashes || []).map((row: any, index: number) => ({
    rank: index + 1,
    search_fingerprint: row.query_hash,
    searches: row.count,
  }));
}

export function flattenLocations(data: any) {
  return (data?.countries || []).map((row: any, index: number) => ({
    rank: index + 1,
    country: row.country,
    events: row.events,
    sessions: row.sessions,
    content_views: row.content_views,
    searches: row.searches,
  }));
}

export function flattenInvestorSnapshot(data: any) {
  const snapshot = data?.snapshot || {};
  return [
    {
      period: snapshot.period,
      active_users_estimate: snapshot.active_users_estimate,
      sessions: snapshot.sessions,
      events: snapshot.events,
      content_views: snapshot.content_views,
      searches: snapshot.searches,
      engagement_actions: snapshot.engagement_actions,
      notes: (snapshot.data_quality_notes || []).join(" | "),
    },
  ];
}
