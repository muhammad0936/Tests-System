const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const studentSchema = new Schema(
  {
    fname: { type: String, required: true },
    lname: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    password: { type: String, required: true },
    phone: { type: String, unique: true, required: true },
    image: {
      url: String,
      publicId: String,
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

studentSchema.plugin(mongoosePaginate);
studentSchema.index(
  { 'redeemedCodes.code': 1, 'redeemedCodes.codesGroup': 1 },
  {
    unique: true,
    partialFilterExpression: { 'redeemedCodes.code': { $exists: true } },
  }
);
module.exports = mongoose.model('Student', studentSchema);
