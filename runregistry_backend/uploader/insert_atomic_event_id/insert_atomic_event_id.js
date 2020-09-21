const { Client } = require('pg');
const queue = require('async').queue;

const connectionString =
  'postgresql://fabioespinosa:@localhost:5432/runregistry_database_new';

const productionString = '';

async function insert_atomic_event_id() {
  const client = new Client({
    connectionString
  });
  await client.connect();

  const result = await client.query(`
        SELECT
        version,
        by, 
        comment,
        "createdAt"
        FROM (
            SELECT 
                version,
                comment,
                by,
                "createdAt",
                lead(comment) OVER (ORDER BY version DESC) as prev_comment,
                lead(by) OVER (ORDER BY version DESC) as prev_by,
                
                lag(comment) OVER (ORDER BY version DESC) AS next_comment,
                lag(by) OVER (ORDER BY version DESC) AS next_by
            FROM
                "Event"
            ORDER BY version DESC
        ) as w2
        where (by, comment) is distinct from (w2.prev_by, w2.prev_comment) 
            OR
            (by, comment) is distinct from (w2.next_by, w2.next_comment) 
        order by version ASC;
    `);
  let i = 1;
  const promises = result.rows.map((row, index, rows) => async () => {
    const { version, by, comment } = row;
    let previous_row = rows[index - 1] || row;

    if (
      by !== previous_row.by ||
      comment !== previous_row.comment ||
      index === 0
    ) {
      const next_row = rows[index + 1];
      if (index === rows.length - 1) {
        // Last case
        await client.query(
          `UPDATE "Event" set atomic_version = ${i} where version = ${version}`
        );
      } else if (by !== next_row.by || comment !== next_row.comment) {
        // Case of a single event:
        await client.query(
          `UPDATE "Event" set atomic_version = ${i} where version = ${version}`
        );
      } else {
        // Case of a normal event
        await client.query(
          `UPDATE "Event" set atomic_version = ${i} where version >= ${version} and version <= ${next_row.version}`
        );
      }
      if (i % 100 === 0) {
        console.log(`progress, event: ${i}`);
      }
      i += 1;
    }
  });
  const number_of_workers = 1;
  const asyncQueue = queue(async run => await run(), number_of_workers);

  // When runs finished saving:
  asyncQueue.drain = async () => {
    console.log(`finished`);
  };
  asyncQueue.error = err => {
    console.log(`Critical error, ${JSON.stringify(err)}`);
  };

  asyncQueue.push(promises);
}

insert_atomic_event_id();
