const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const materialSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    color: {
      type: String,
    },
    icon: {
      filename: String,
      accessUrl: String,
    },
    college: {
      type: Schema.Types.ObjectId,
      ref: 'College',
      required: true,
    },
  },
  { timestamps: true }
);
materialSchema.plugin(mongoosePaginate);
materialSchema.index({ college: 1 });

module.exports = mongoose.model('Material', materialSchema);
