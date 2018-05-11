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
  const room = db.collection('rooms').findOne({ users: user._id.toString() });
  if (!room) {
    throw new Error('Room not found');
  }

  await db.collection('messages').updateOne({ _id: ObjectId(messageId), roomId: room._id }, { $set: { read: true } });
  return { messageId, roomId: room._id.toString() };
}

async function markAllUnread(db, user, roomId) {
  await db
    .collection('messages')
    .updateMany({
      roomId,
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
async function getMessages(db, currentUser, { roomId, limit = 10, offset = 0, from }) {
  const room = await getRoom(db, roomId, currentUser);

  if (!room) throw new Error(`Room ${roomId} not found`);

  const query = { roomId },
    projection = {};

  if (from) {
    query._id = { $gt: ObjectId(from) };
  } else {
    projection.$slice = [-offset, -limit];
  }

  const messages =  await db.collection('messages')
    .find(query)
    // .project(projection)
    .sort({ _id: 1 })
    .toArray();

  return messages;
}

async function getMessagesState(db, currentUser, messages) {
  return messagesState =  await db.collection('messages')
    .find({ _id: { $in: messages.map(m => ObjectId(m)) } })
    .project({ read: 1 })
    .sort({ _id: 1 })
    .toArray();
}

module.exports = {
  sendMessage,
  getMessages,
  markAsRead,
  markAllUnread,
  getMessagesState
};
