const admin = require('firebase-admin');
const serviceAccount = require('./fahim-5a1d6-firebase-adminsdk-fbsvc-006b735a39.json'); // Replace with actual path
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
