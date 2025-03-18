const College = require('../../models/College');
const Material = require('../../models/Material');
const Student = require('../../models/Student');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');

exports.getFreeMaterials = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const filter = {};
    const student = await Student.findById(req.userId);
    if (!student.college) {
      return res
        .status(400)
        .json({ message: 'This student has no college ID!' });
    }
    const college = await College.findById(student.college);
    if (!college) {
      return res
        .status(400)
        .json({ message: 'This student has invalid college ID!' });
    }
    filter.college = college._id;
    if (!student.year)
      return res.status(400).json({ message: 'This student has no year!' });
    if (student.year > college.numOfYears || student.year < 1)
      return res.status(400).json({
        message: `This student has invalid year, it must be between 0 and ${college.numOfYears}.`,
      });
    filter.year = Number(student.year);
    console.log(filter);
    const materials = await Material.paginate(filter, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      populate: {
        path: 'college',
        select: 'name',
      },
      select: '-__v -createdAt -updatedAt',
    });
    res.status(200).json(materials);
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'Server error' });
  }
};
