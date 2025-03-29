const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true, // one record per email to track OTP and attempts
      trim: true,
      lowercase: true,
      match: [/\S+@\S+\.\S+/, 'Invalid email format'],
    },
    otp: {
      type: String,
      required: [true, 'OTP code is required'],
      minlength: [6, 'OTP must be 6 digits'],
      maxlength: [6, 'OTP must be 6 digits'],
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: [0, 'Attempts cannot be negative'],
    },
    // Field to track the start of the 12-hour OTP window.
    firstOtpSentAt: {
      type: Date,
      required: true,
      index: { expires: '12h' }, // Auto-delete entire record after 12 hours
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('Otp', otpSchema);
