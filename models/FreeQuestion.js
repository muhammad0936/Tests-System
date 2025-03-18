const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const freeQuestionSchema = new Schema(
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
freeQuestionSchema.plugin(mongoosePaginate);
freeQuestionSchema.index({ material: 1 });

module.exports = mongoose.model('FreeQuestion', freeQuestionSchema);
