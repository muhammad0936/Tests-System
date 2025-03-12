const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const studentSchema = new Schema(
  {
    fname: {
      type: String,
      required: true,
    },
    lname: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      unique: true,
      required: true,
    },
    image: {
      url: String,
      publicId: String,
    },
    year: {
      type: Number,
      required: true,
    },
    codes: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Code',
        required: true,
      },
    ],
    favorites: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Question',
        required: true,
      },
    ],
    resetToken: String,
    resetTokenExpiration: Date,
  },
  { timestamps: true }
);
studentSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Student', studentSchema);
