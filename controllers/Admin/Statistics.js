const mongoose = require('mongoose');
const Teacher = require('../../models/Teacher');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');

exports.getTeachersStatistics = async (req, res) => {
  try {
    await ensureIsAdmin(req.userId);

    const stats = await Teacher.aggregate([
      {
        $lookup: {
          from: 'courses',
          localField: '_id',
          foreignField: 'teacher',
          as: 'courses',
        },
      },
      {
        $match: {
          'courses.0': { $exists: true },
        },
      },
      { $unwind: '$courses' },
      {
        $lookup: {
          from: 'codesgroups',
          let: { courseId: '$courses._id' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$$courseId', '$courses'] },
                'codes.isUsed': true,
              },
            },
            { $unwind: '$codes' },
            { $match: { 'codes.isUsed': true } },
            { $count: 'usedCount' },
          ],
          as: 'redemptions',
        },
      },
      {
        $lookup: {
          from: 'materials',
          localField: 'courses.material',
          foreignField: '_id',
          as: 'materialInfo',
        },
      },
      {
        $group: {
          _id: '$_id',
          name: {
            $first: {
              $concat: ['$fname', ' ', '$lname'],
            },
          },
          courses: {
            $push: {
              courseId: '$courses._id',
              name: '$courses.name',
              material: {
                $arrayElemAt: ['$materialInfo.name', 0],
              },
              numberOfRedemptions: {
                $ifNull: [{ $arrayElemAt: ['$redemptions.usedCount', 0] }, 0],
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          teacherId: '$_id',
          name: 1,
          courses: 1,
        },
      },
    ]);

    res.status(200).json(stats);
  } catch (err) {
    console.error('Error fetching teacher statistics:', err);
    res.status(500).json({
      error: err.message || 'حدث خطأ في الخادم.',
    });
  }
};
