const { findUserBySid, getUsers, saveUser } = require('./database/user');
const {
  joinRoom, leaveRoom, getRooms, createRoom,
} = require('./database/room');
const {
  getMessages, sendMessage, markAsRead, markAllUnread,
} = require('./database/messages');
const TYPES = require('./messages');

/**
 * @param {Db} db
 * @param {*} io
 */
// eslint-disable-next-line func-names
module.exports = function (db, io) {
  const ONLINE = {};

  /**
     * @param {Pagination<User>} users
     * @return {Pagination<User>}
     */
  function fillUsersWithStatus(users) {
    // eslint-disable-next-line no-param-reassign

    return users.map(user => ({ ...user, online: Boolean(ONLINE[user._id]) }));
  }

  /**
     * Connection is created
     */
  io.on('connection', (socket) => {
    const { sid } = socket.request.cookies;
    let isDisconnected = false;

    socket.join('broadcast');

    /**
         * Invoke callback and handle errors
         *
         * @param callback
         */
    function wrapCallback(callback) {
      // eslint-disable-next-line func-names
      return function (...args) {
        const printErr = (err) => {
          // eslint-disable-next-line no-console
          console.error(err);

          socket.emit(TYPES.ERROR, {
            message: err.message,
            stack: err.stack,
          });
        };

        try {
          callback(...args).catch(printErr);
        } catch (err) {
          printErr(err);
        }
      };
    }

    /**
         * Send notification to every user about status change
         *
         * @param {string} userId
         */
    function userChangeOnlineStatus(userId) {
      socket.broadcast.emit(TYPES.ONLINE, {
        status: ONLINE[userId],
        userId,
      });
    }

    /**
         * Join to socket channel, to broadcast messages inside Room
         *
         * @param {string} roomId
         */
    // eslint-disable-next-line no-empty-pattern
    function joinToRoomChannel(roomId) {
      socket.join(`room:${roomId}`);
    }

    /**
         * Leave socket channel
         *
         * @param {string} roomId
         */
    function leaveRoomChannel(roomId) {
      socket.leave(`room:${roomId}`);
    }

    /**
         * Broadcast messages inside Room about user joined
         *
         * @param {string} userId
         * @param {string} roomId
         */
    function userWasJoinedToRoom({ userId, roomId }) {
      socket.to(`room:${roomId}`).emit(TYPES.USER_JOINED, { userId, roomId });
    }

    /**
         * Broadcast messages inside Room about user leave
         *
         * @param {string} userId
         * @param {string} roomId
         */
    function userLeaveRoom({ userId, roomId }) {
      socket.to(`room:${roomId}`).emit(TYPES.USER_LEAVED, { userId, roomId });
    }

    /**
         * New message coming to room
         *
         * @param {Message} message
         */
    function newMessage(message) {
      socket.to(`room:${message.roomId}`).emit(TYPES.MESSAGE, message);
    }

    // Load user information for next usage
    const userPromise = findUserBySid(db, sid).catch((error) => {
      throw new Error(`Cannot load user: ${error}`);
    });

    // Receive current user information
    socket.on(TYPES.CURRENT_USER, wrapCallback(async ({ requestId }) => {
      socket.emit(TYPES.CURRENT_USER, { requestId, payload: await userPromise });
    }));

    // Update user information
    socket.on(TYPES.UPDATE_USER, wrapCallback(async ({ requestId, payload }) => {
      socket.emit(TYPES.UPDATE_USER, { requestId, payload: await saveUser(db, payload) });
    }));

    // Return list of all users with
    socket.on(TYPES.USERS, wrapCallback(async ({ requestId, payload }) => {
      socket.emit(TYPES.USERS, { requestId, payload: fillUsersWithStatus(await getUsers(db, payload || {})) });
    }));

    // Create room
    socket.on(TYPES.CREATE_ROOM, wrapCallback(async ({ requestId, payload }) => {
      const currentUser = await userPromise,
        { insertedId } = await createRoom(db, currentUser, payload);

      joinToRoomChannel(insertedId);

      socket.broadcast.emit(TYPES.NEW_ROOM, insertedId);

      socket.emit(TYPES.CREATE_ROOM, { requestId, payload: { _id: insertedId } });
    }));

    // Rooms of current user
    socket.on(TYPES.CURRENT_USER_ROOMS, wrapCallback(async ({ requestId }) => {
      const currentUser = await userPromise;

      const rooms = await getRooms(db, currentUser);

      rooms.forEach(({ _id }) => {
        if (!socket[`room:${_id}`]) joinToRoomChannel(_id);
      });

      socket.emit(TYPES.CURRENT_USER_ROOMS, { requestId, payload: rooms });
    }));

    // Join current user to room
    socket.on(TYPES.CURRENT_USER_JOIN_ROOM, wrapCallback(async ({ requestId, payload }) => {
      const currentUser = await userPromise;

      const params = {
        roomId: payload.roomId,
        userId: currentUser._id,
      };

      socket.emit(TYPES.CURRENT_USER_JOIN_ROOM, { requestId, payload: await joinRoom(db, currentUser, params) });

      joinToRoomChannel(payload.roomId);
      userWasJoinedToRoom(params);
    }));

    // Join user to room
    socket.on(TYPES.USER_JOIN_ROOM, wrapCallback(async ({ requestId, payload }) => {
      const currentUser = await userPromise;
      socket.emit(TYPES.USER_JOIN_ROOM, { requestId, payload: await joinRoom(db, currentUser, payload) });

      joinToRoomChannel(payload.roomId);
      userWasJoinedToRoom(payload);
    }));

    // Leave current user to room
    socket.on(TYPES.CURRENT_USER_LEAVE_ROOM, wrapCallback(async ({ requestId, payload }) => {
      const currentUser = await userPromise;

      const params = {
        roomId: payload.roomId,
        userId: currentUser._id,
      };

      socket.emit(TYPES.CURRENT_USER_LEAVE_ROOM, { requestId, payload: await leaveRoom(db, currentUser, params) });

      leaveRoomChannel(payload.roomId);
      userLeaveRoom(params);
    }));

    // Send message
    socket.on(TYPES.SEND_MESSAGE, wrapCallback(async ({ requestId, payload }) => {
      const currentUser = await userPromise;

      const message = await sendMessage(db, currentUser, payload);

      socket.emit(TYPES.SEND_MESSAGE, { requestId, payload: message });

      newMessage({ ...message, roomId: payload.roomId });
    }));

    socket.on(TYPES.MARK_AS_READ, wrapCallback(async ({ requestId, payload }) => {
      const currentUser = await userPromise;

      const mark = await markAsRead(db, currentUser, payload);

      socket.to(`room:${mark.roomId}`).emit(TYPES.MARK_AS_READ, { requestId, payload: mark });
    }));

    socket.on(TYPES.MARK_ALL_UNREAD, wrapCallback(async ({ payload }) => {
      const currentUser = await userPromise;

      const roomId = await markAllUnread(db, currentUser, payload);

      socket.to(`room:${roomId}`).emit(TYPES.MARK_ALL_UNREAD, roomId);
    }));

    // Send message
    socket.on(TYPES.MESSAGES, wrapCallback(async ({ requestId, payload }) => {
      const currentUser = await userPromise,
        messages = await getMessages(db, currentUser, payload);
      socket.emit(TYPES.MESSAGES, { requestId, payload: messages });
    }));

    userPromise.then(async (user) => {
      if (!isDisconnected) {
        ONLINE[user._id] = true;
      }

      userChangeOnlineStatus(user._id);

      // Get of user groups
      const rooms = await getRooms(db, user);
      rooms.forEach((room) => {
        joinToRoomChannel(room._id);
      });
    });

    socket.on('disconnect', async () => {
      isDisconnected = true;
      const user = await userPromise;

      ONLINE[user._id] = false;

      userChangeOnlineStatus(user._id);
    });
  });
};
