const { ObjectId } = require('mongodb');

const { getSessionInfo, saveSessionInfo } = require('./session');
const { insertOrUpdateEntity } = require('./helpers');

const TABLE = 'users';

/**
 * @typedef {{
 *  [_id]: string,
 *  name: string,
 *  email: string,
 *  phone: string,
 *  [status]: boolean
 * }} User
 */

/**
 * @param {Db} db
 * @param {string} userId
 *
 * @returns {Promise<User>}
 */
async function getUser(db, userId) {
  return db.collection(TABLE).findOne({ _id: ObjectId(userId.toString()) });
}

/**
 * @param {Db} db
 * @param {User} user
 *
 * @returns {Promise<User>}
 */
async function saveUser(db, user) {
  return insertOrUpdateEntity(db.collection(TABLE), user);
}

/**
 * @param {Db} db
 * @param {string} sid Session ID
 *
 * @returns {Promise<User>}
 */
async function findUserBySid(db, sid) {
  const session = await getSessionInfo(db, sid);

  if (!session.userId) {
    // Create empty user

    let user = {
      name: '',
      email: '',
      phone: '',
    };

    user = await saveUser(db, user);

    session.userId = user._id;

    await saveSessionInfo(db, session);

    return user;
  }
  return db.collection(TABLE).findOne({ _id: session.userId });
}

/**
 * @param {Db} db
 * @param {{}} [filter]
 *
 * @return {Promise<Pagination<User>>}
 */
async function getUsers(db, filter) {
  const queryParams = { ...filter };

  if (queryParams._id) {
    queryParams._id = { $in: queryParams._id.map(id => ObjectId(id)) };
  }

  return db.collection(TABLE).find(queryParams).toArray();
}

module.exports = {
  findUserBySid,
  getUsers,
  getUser,
  saveUser,
};
