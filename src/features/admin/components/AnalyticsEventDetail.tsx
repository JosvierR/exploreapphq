import type { ReactNode } from "react";
import type { AnalyticsEventRow } from "@/lib/adminAnalyticsApi";
import { AdminDataTable, EmptyState } from "@/features/admin/components/AdminPrimitives";
import {
  authLabel,
  entityLabel,
  eventLabel,
  formatAnalyticsJson,
  formatPropertyValue,
  platformLabel,
  sourceLabel,
} from "@/lib/analyticsDisplay";

type DetailRow = {
  label: string;
  value: ReactNode;
};

export function AnalyticsEventDetail({ event }: { event: AnalyticsEventRow }) {
  const coreRows: DetailRow[] = [
    { label: "Event", value: eventLabel(event.event_name) },
    { label: "Event ID", value: <code>{event.event_id}</code> },
    { label: "Received", value: formatPropertyValue("received_at", event.received_at) },
    { label: "Occurred", value: formatPropertyValue("occurred_at", event.occurred_at) },
    { label: "Source", value: sourceLabel(event.source) },
    { label: "Platform", value: platformLabel(event.platform) },
    { label: "Content type", value: event.entity_type ? entityLabel(event.entity_type) : "Not available" },
    { label: "Content ID", value: event.entity_id ? <code>{event.entity_id}</code> : "Not available" },
    { label: "Auth", value: authLabel(event.user_id_present) },
    { label: "Anonymous ID", value: event.anonymous_id_short ? <code>{event.anonymous_id_short}</code> : "Not available" },
    { label: "Session ID", value: event.session_id_short ? <code>{event.session_id_short}</code> : "Not available" },
    { label: "App version", value: formatPropertyValue("app_version", event.app_version) },
    { label: "Build number", value: formatPropertyValue("build_number", event.build_number) },
  ];

  return (
    <div className="admin-event-detail">
      <KeyValueTable label="Event fields" rows={coreRows} />
      <JsonFieldTable title="Properties" rows={formatAnalyticsJson(event.properties)} />
      <JsonFieldTable title="Context" rows={formatAnalyticsJson(event.context)} />
    </div>
  );
}

function KeyValueTable({ label, rows }: { label: string; rows: DetailRow[] }) {
  return (
    <AdminDataTable label={label}>
      <thead>
        <tr>
          <th>Field</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td>{row.label}</td>
            <td>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </AdminDataTable>
  );
}

function JsonFieldTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: string; label: string; value: string }>;
}) {
  if (rows.length === 0) {
    return <EmptyState title={`No ${title.toLowerCase()}`} message={`This event did not include safe ${title.toLowerCase()}.`} />;
  }

  return (
    <AdminDataTable label={title}>
      <thead>
        <tr>
          <th>Field</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td>{row.label}</td>
            <td>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </AdminDataTable>
  );
}
