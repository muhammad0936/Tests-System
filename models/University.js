const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const universitySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    icon: {
      filename: String,
      accessUrl: String,
    },
  },
  { timestamps: true }
);
universitySchema.plugin(mongoosePaginate);

module.exports = mongoose.model('University', universitySchema);
