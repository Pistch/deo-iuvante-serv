const mongo = require('mongodb');

/**
 * Connect to database
 *
 * @param {MongoConfig} config
 *
 * @return {Promise<Db>}
 */
function createConnection(config) {
  return mongo.connect('mongodb+srv://pistch:t0n7SZkXJO3JGJ4t@deo-iuvante-edyut.mongodb.net/test')
    .then(client => client.db(config.database))
    .catch(err => console.log(err));
}

/**
 * Create connection to database
 *
 * @param {MongoConfig} config
 *
 * @return {Promise<MongoClient>}
 */
function connect(config) {
  return createConnection(config);
}

module.exports = {
  connect,
};
