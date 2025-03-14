const mongoose = require('mongoose');
const Video = require('../../models/Video');
const Course = require('../../models/Course');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');

// Create a new video
exports.createVideo = [
  body('name').notEmpty().withMessage('Video name is required'),
  body('course').isMongoId().withMessage('Invalid Course ID'),
  body('video.url')
    .optional()
    .isString()
    .withMessage('Video URL must be a string'),
  body('video.publicId')
    .optional()
    .isString()
    .withMessage('Video publicId must be a string'),
  async (req, res) => {
    await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      // Verify if the associated course exists
      const courseExists = await Course.exists({ _id: req.body.course });
      if (!courseExists) {
        return res.status(400).json({ message: 'Course not found!' });
      }
      const video = new Video(req.body);
      await video.save();

      // Destructure to send back an appropriate response
      const { _id, name, video: videoDetails, course } = video;
      res.status(201).json({
        video: { _id, name, video: videoDetails, course },
      });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'Server error' });
    }
  },
];

// Get videos with pagination and filters
exports.getVideos = async (req, res) => {
  try {
    await ensureIsAdmin(req.userId);
    // Destructure pagination and filter parameters from the query string
    const { page, limit, name, course } = req.query;
    const filter = {};

    // Filter based on video name using a case-insensitive regex
    if (name) {
      filter.name = { $regex: name, $options: 'i' };
    }

    if (!course) {
      return res.status(400).json({ message: 'Course must be provided!' });
    }

    // Verify if the provided course exists
    const courseExists = await Course.exists({ _id: course });
    if (!courseExists) {
      return res.status(400).json({ message: 'Course not found!' });
    }
    filter.course = new mongoose.Types.ObjectId(course);

    // Paginate videos based on filter and pagination options
    const videos = await Video.paginate(filter, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      populate: { path: 'course', select: 'name description' },
      select: 'name video course',
    });

    res.status(200).json(videos);
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'Server error' });
  }
};

// Delete a video by ID
exports.deleteVideo = [
  param('id').isMongoId().withMessage('Invalid Video ID'),
  async (req, res) => {
    await ensureIsAdmin(req.userId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const video = await Video.findByIdAndDelete(req.params.id);
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }
      res.status(200).json({ message: 'Video deleted successfully' });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'Server error' });
    }
  },
];
