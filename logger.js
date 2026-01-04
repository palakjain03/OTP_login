const db = require('../config/db');

module.exports = async function logEvent(traceId, api, step, status, message) {
  await db.query(
    'INSERT INTO audit_logs (trace_id, api_name, step, status, message) VALUES (?,?,?,?,?)',
    [traceId, api, step, status, message]
  );
};
