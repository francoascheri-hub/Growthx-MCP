// Read-only schema inspection of the intel knowledge graph. Usage: node --env-file=.env.local scripts/intel-inspect.mjs ["SELECT ..."]
import pg from "pg";

const url = process.env.INTEL_DATABASE_URL;
if (!url) throw new Error("INTEL_DATABASE_URL missing");
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");
await client.query("BEGIN READ ONLY");
try {
  const sql = process.argv[2];
  if (sql) {
    if (!/^\s*(select|with)\b/i.test(sql)) throw new Error("SELECT only");
    const r = await client.query(sql);
    console.log(JSON.stringify(r.rows, null, 1).slice(0, 12000));
  } else {
    const r = await client.query(
      `select table_name, string_agg(column_name || ':' || data_type, ', ' order by ordinal_position) cols
       from information_schema.columns where table_schema = 'intel' group by table_name order by table_name`,
    );
    for (const row of r.rows) console.log(`${row.table_name}: ${row.cols}`);
  }
} finally {
  await client.query("ROLLBACK");
  await client.end();
}
