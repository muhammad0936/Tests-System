const University = require('../../models/University');
const College = require('../../models/College');

exports.getBaccalaureate = async (req, res) => {
  try {
    const university = await University.findOne({ name: 'بكالوريا' });
    const college = await College.findOne({ name: 'بكالوريا' });
    res.status(200).json({ university: university._id, college: college._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'حدث خطأ في الخادم' });
  }
};
