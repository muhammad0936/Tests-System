const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const collegeSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    icon: {
      url: String,
      publicId: String,
    },
    university: {
      type: Schema.Types.ObjectId,
      ref: 'University',
      required: true,
    },
  },
  { timestamps: true }
);
collegeSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('College', collegeSchema);
