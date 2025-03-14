const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const videoSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    video: {
      url: String,
      publicId: String,
    },
    course: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
  },
  { timestamps: true }
);
videoSchema.plugin(mongoosePaginate);
videoSchema.index({ course: 1 });

module.exports = mongoose.model('Video', videoSchema);
