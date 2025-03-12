const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const codeSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
    },
    expiration: {
      type: Date,
      required: true,
    },
    materilas: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Material',
        required: true,
      },
    ],
    courses: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
      },
    ],
  },
  { timestamps: true }
);
codeSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Code', codeSchema);
