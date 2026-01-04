const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const logEvent = require('../utils/logger');

exports.sendOtp = async (req, res) => {
  const traceId = uuidv4();
  const { identifier } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hash = await bcrypt.hash(otp, 10);
  const expiry = new Date(Date.now() + 5*60000);

  await db.query(
    'INSERT INTO otp_requests (identifier, otp_hash, expires_at) VALUES (?,?,?)',
    [identifier, hash, expiry]
  );
  await logEvent(traceId,'SEND_OTP','OTP_GENERATED','SUCCESS','OTP created');
  console.log('OTP (testing):', otp);
  res.json({ message: 'OTP sent successfully' });
};

exports.verifyOtp = async (req, res) => {
  const traceId = uuidv4();
  const { identifier, otp } = req.body;
  const [rows] = await db.query(
    `SELECT * FROM otp_requests WHERE identifier=? AND status='PENDING'
     ORDER BY created_at DESC LIMIT 1`, [identifier]);

  if (!rows.length) return res.status(400).json({ error:'OTP not found' });

  const r = rows[0];
  if (new Date() > r.expires_at) return res.status(400).json({ error:'OTP expired' });

  if (r.attempts >= r.max_attempts) {
    await db.query('UPDATE otp_requests SET status="BLOCKED" WHERE id=?',[r.id]);
    return res.status(403).json({ error:'Blocked' });
  }

  const ok = await bcrypt.compare(otp, r.otp_hash);
  if (!ok) {
    await db.query('UPDATE otp_requests SET attempts=attempts+1 WHERE id=?',[r.id]);
    await logEvent(traceId,'VERIFY_OTP','INVALID','FAILED','Wrong OTP');
    return res.status(400).json({ error:'Invalid OTP' });
  }

  await db.query('UPDATE otp_requests SET status="VERIFIED" WHERE id=?',[r.id]);
  await logEvent(traceId,'VERIFY_OTP','SUCCESS','SUCCESS','Login successful');
  res.json({ message:'Login successful' });
};

exports.resendOtp = async (req, res) => {
  const traceId = uuidv4();
  const { identifier } = req.body;
  const [rows] = await db.query(
    'SELECT * FROM otp_requests WHERE identifier=? ORDER BY created_at DESC LIMIT 1',
    [identifier]);

  if (rows[0].resend_count >= 3)
    return res.status(429).json({ error:'Resend limit reached' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hash = await bcrypt.hash(otp, 10);
  const expiry = new Date(Date.now() + 5*60000);

  await db.query(
    'UPDATE otp_requests SET otp_hash=?,expires_at=?,resend_count=resend_count+1 WHERE id=?',
    [hash, expiry, rows[0].id]
  );
  await logEvent(traceId,'RESEND_OTP','SUCCESS','SUCCESS','OTP resent');
  console.log('New OTP:', otp);
  res.json({ message:'OTP resent' });
};
