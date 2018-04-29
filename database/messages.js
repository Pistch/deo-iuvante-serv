const { ObjectId } = require('mongodb');

const { getRoom } = require('./room');

/**
 * @typedef {{
 *  _id: object,
 *  userId: string,
 *  text: string,
 *  [attachments]: string[],
 *  time: number,
 *  read: boolean
 * }} Message
 */

/**
 * @param {Db} db
 * @param {User} user
 * @param {string} message
 *
 * @return {Promise<Message>}
 */
async function sendMessage(db, user, message) {
  if (!user) {
    throw new Error('userId required');
  }

  if (!message.roomId) {
    throw new Error('roomId required');
  }

  if (!message.text) {
    throw new Error('Cannot send empty message');
  }

  const room = await getRoom(db, message.roomId, user);

  if (!room) {
    throw new Error(`Cannot find room with id=${message.roomId}`);
  }

  const messageEntity = {
    userId: user._id.toString(),
    roomId: message.roomId,
    text: message.text,
    time: Date.now(),
    attachments: message.attachments || null,
    read: false,
  };

  const { insertedId } = await db.collection('messages').insertOne(messageEntity);

  await db.collection('rooms').updateOne({ _id: room._id }, {
    $push: {
      messages: {
        $each: [insertedId.toString()],
        $position: 0,
      },
    },
    $inc: { messagesCount: 1 },
  });

  return {
    ...messageEntity,
    _id: insertedId,
  };
}

/**
 * @param {Db} db
 * @param {User} user
 * @param {string} messageId
 *
 * @return object
 */
async function markAsRead(db, user, messageId) {
  const room = db.collection('rooms').findOne({ messages: messageId, users: user._id.toString() });
  if (!room) {
    throw new Error('Message not found');
  }

  await db.collection('messages').updateOne({ _id: ObjectId(messageId) }, { $set: { read: true } });
  return { messageId, roomId: room._id.toString() };
}

async function markAllUnread(db, user, roomId) {
  const room = await db.collection('rooms').findOne({ _id: ObjectId(roomId) });

  await db
    .collection('messages')
    .updateMany({
      _id: { $in: room.messages.map(id => ObjectId(id)) },
      userId: { $ne: user._id.toString() },
      read: false,
    }, {
      $set: {
        read: true,
      },
    });

  return roomId;
}

/**
 * @param {Db} db
 * @param {User} currentUser
 * @param {{}} [filter]
 *
 * @return {Promise<Pagination<Message>>}
 */
async function getMessages(db, currentUser, { roomId, limit = 10, offset = 0 }) {
  const room = await getRoom(db, roomId, currentUser, [offset, limit]);

  if (!room) {
    throw new Error(`Cannot find room with id=${roomId}`);
  }

  return room.messages;
}

module.exports = {
  sendMessage,
  getMessages,
  markAsRead,
  markAllUnread,
};
