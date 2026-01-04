const router = require('express').Router();
const auth = require('../controllers/authController');

router.post('/send-otp', auth.sendOtp);
router.post('/verify-otp', auth.verifyOtp);
router.post('/resend-otp', auth.resendOtp);

module.exports = router;
