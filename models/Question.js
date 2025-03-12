const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const questionSchema = new Schema(
  {
    text: {
      type: String,
      required: true,
    },
    isMultipleChoice: {
      type: Boolean,
      default: false,
    },
    choices: [
      {
        text: {
          type: String,
          required: true,
        },
        isCorrect: {
          type: Boolean,
          default: false,
        },
      },
    ],
    information: {
      type: String,
    },
    image: {
      url: String,
      publicId: String,
    },
    material: {
      type: Schema.Types.ObjectId,
      ref: 'Material',
      required: true,
    },
  }
  // { timestamps: true }
);
questionSchema.plugin(mongoosePaginate);
questionSchema.index({ material: 1 });

module.exports = mongoose.model('Question', questionSchema);
