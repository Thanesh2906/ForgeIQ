// Optional real multi-connection PostgreSQL check. Run only against a disposable migrated Supabase DB.
import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
if (!process.env.TEST_DATABASE_URL || process.env.ALLOW_DISPOSABLE_DB_TEST !== 'yes') {
  throw new Error(
    'Set TEST_DATABASE_URL to a disposable migrated database and ALLOW_DISPOSABLE_DB_TEST=yes. Never run against production.',
  );
}
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 5 });
const user = randomUUID(),
  file = randomUUID(),
  request = randomUUID();
try {
  await pool.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{}')", [
    user,
    `forgeiq-test-${user}@example.com`,
  ]);
  await pool.query('update profiles set consent_at=now() where id=$1', [user]);
  await pool.query('update wallets set balance=100 where user_id=$1', [user]);
  await pool.query(
    "insert into uploaded_files(id,user_id,name,storage_path,mime_type,size_bytes,status,expires_at) values($1,$2,'test.pdf',$3,'application/pdf',100,'ready',now()+interval '1 day')",
    [file, user, `test/${file}`],
  );
  const calls = await Promise.all(
    Array.from({ length: 5 }, () =>
      pool.query(
        "select begin_analysis($1,'quotation','Concurrent test',array[$2::uuid],$3) as id",
        [user, file, request],
      ),
    ),
  );
  assert.equal(new Set(calls.map((r) => r.rows[0].id)).size, 1);
  const job = calls[0].rows[0].id;
  assert.equal(
    (
      await pool.query(
        'select count(*)::int as n from credit_transactions where job_id=$1 and kind=$2',
        [job, 'charge'],
      )
    ).rows[0].n,
    1,
  );
  await Promise.all(
    Array.from({ length: 5 }, () => pool.query("select fail_analysis($1,'TEST')", [job])),
  );
  assert.equal(
    (await pool.query('select balance from wallets where user_id=$1', [user])).rows[0].balance,
    100,
  );
  assert.equal(
    (
      await pool.query(
        'select count(*)::int as n from credit_transactions where job_id=$1 and kind=$2',
        [job, 'refund'],
      )
    ).rows[0].n,
    1,
  );
  console.log('Concurrent deductions and refunds passed.');
} finally {
  await pool.query('delete from auth.users where id=$1', [user]);
  await pool.end();
}
