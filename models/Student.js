const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const studentSchema = new Schema(
  {
    fname: { type: String, required: true },
    lname: { type: String },
    email: { type: String, unique: true, sparse: true },
    password: { type: String, required: true },
    phone: { type: String, unique: true, required: true },
    image: {
      url: String,
      publicId: String,
    },
    university: {
      type: Schema.Types.ObjectId,
      ref: 'University',
      required: true,
    },
    college: {
      type: Schema.Types.ObjectId,
      ref: 'College',
      required: true,
    },
    year: { type: Number, required: true },
    redeemedCodes: [
      {
        code: {
          type: String,
          required: true,
        },
        codesGroup: {
          type: Schema.Types.ObjectId,
          ref: 'CodesGroup',
          required: true,
        },
        redeemedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    favorites: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Question',
      },
    ],
    resetToken: String,
    resetTokenExpiration: Date,
  },
  { timestamps: true }
);

// studentSchema.pre('save', async function (next) {
//   if (this.isModified('password')) {
//     this.password = await myPasswordHashingFunction(this.password);
//   }
//   next();
// });
studentSchema.pre('save', function (next) {
  const groups = new Set();

  // Only check if redeemedCodes is modified
  if (!this.isModified('redeemedCodes')) return next();

  for (const redemption of this.redeemedCodes) {
    const groupId = redemption.codesGroup.toString();
    if (groups.has(groupId)) {
      return next(new Error('Student already has a code from this CodesGroup'));
    }
    groups.add(groupId);
  }
  next();
});

studentSchema.plugin(mongoosePaginate);
studentSchema.index(
  { 'redeemedCodes.code': 1, 'redeemedCodes.codesGroup': 1 },
  {
    unique: true,
    partialFilterExpression: { 'redeemedCodes.code': { $exists: true } },
  }
);
module.exports = mongoose.model('Student', studentSchema);
