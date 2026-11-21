import assert from "node:assert/strict";
import { pool } from "../server/db";

const client = await pool.connect();

try {
  const columns = await client.query<{
    column_name: string;
    data_type: string;
  }>(`
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and ((table_name = 'chat_messages' and column_name = 'timestamp')
        or (table_name = 'chat_conversations' and column_name in ('started_at', 'archived_at')))
    order by table_name, column_name
  `);
  if (
    !columns.rows.some(
      (column) => column.data_type === "timestamp without time zone",
    )
  ) {
    console.log("chat timestamps already include a timezone");
    process.exit(0);
  }

  const profileTimezones = await client.query<{ timezone: string }>(`
    select distinct timezone from user_profiles where timezone is not null and timezone <> ''
  `);
  const timezones = process.env.CHAT_TIMESTAMP_TIMEZONE
    ? [process.env.CHAT_TIMESTAMP_TIMEZONE]
    : profileTimezones.rows.map((row) => row.timezone);
  assert.equal(
    timezones.length,
    1,
    "Set CHAT_TIMESTAMP_TIMEZONE to the timezone used when this instance saved its chat records.",
  );
  assert.match(
    timezones[0],
    /^[A-Za-z_]+(?:\/[A-Za-z_]+)+$/,
    "CHAT_TIMESTAMP_TIMEZONE must be an IANA timezone.",
  );

  await client.query("begin");
  for (const [table, column] of [
    ["chat_messages", "timestamp"],
    ["chat_conversations", "started_at"],
    ["chat_conversations", "archived_at"],
  ]) {
    await client.query(
      `alter table ${table} alter column ${column} type timestamp with time zone using ${column} at time zone '${timezones[0]}'`,
    );
  }
  await client.query("commit");
  console.log(`chat timestamps migrated using ${timezones[0]}`);
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
}
