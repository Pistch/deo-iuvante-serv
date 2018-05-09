const path = require('path');
const fs = require('fs');
const { thumbnail } = require('easyimage');

module.exports.avatar = (db) => async (req, res) => {
  const session = await db.collection('sessions').findOne({ sid: req.cookies.sid });

  if (!session) {
    return res.setRequestHeader(403);
  }

  const filename = req.files.image.path.slice(req.files.image.path.lastIndexOf('/') + 1);

  const thumbnailInfo = await thumbnail({
    src: req.files.image.path,
    width: 300,
    height: 300,
    gravity: 'Center'
  });

  fs.copyFile(thumbnailInfo.path, path.join(__dirname, './avatars/' + filename), 0, async (err) => {
    if (err) throw err;
    db.collection('users').findOneAndUpdate({ _id: session.userId }, { $set: { avatarUrl: filename } });
    res.end('ok');
    fs.unlink(req.files.image.path, () => {});
    fs.unlink(thumbnailInfo.path, () => {});
  });
};
