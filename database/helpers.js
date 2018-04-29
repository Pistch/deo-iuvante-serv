const { ObjectId } = require('mongodb');

/**
 * @typedef {{
 *  items: T[],
 *  next: *,
 *  count: number
 * }} Pagination<T>
 */


/**
 * Create pagination
 *
 * @param {Collection} collection
 * @param filter
 */
async function pageableCollection(collection, {
  lastId, order, limit = 500, ...rest
} = {}) {
  const query = { ...rest };

  if (lastId) {
    query._id = {
      $gt: ObjectId(lastId),
    };
  }

  if (query._id) {
    query._id = ObjectId(query._id.toString());
  }

  const count = await collection.find(query).count();

  let queryBuilder = collection.find(query, { limit });

  if (order) {
    queryBuilder = queryBuilder.sort(order);
  }

  const cursor = await queryBuilder,
    items = await cursor.toArray();
  let next = null;

  if (items.length === limit) {
    next = {
      limit,
      order,
      lastId: items[items.length - 1]._id,
      ...query,
    };
  }

  return {
    count,
    items,
    next,
  };
}

/**
 * Create pagination
 *
 * @param {Collection} collection
 * @param {*} data
 *
 * @return {Promise<*>}
 */
async function insertOrUpdateEntity(collection, data) {
  if (data._id) {
    const { _id, ...props } = data;

    const result = await collection.findOneAndUpdate(
      { _id: ObjectId(_id) },
      { $set: props },
      { returnOriginal: false },
    );

    // eslint-disable-next-line no-console
    console.log(result);

    return result.value;
  }

  const result = await collection.insertOne(data);

  return {
    ...data,
    _id: result.insertedId,
  };
}

module.exports = {
  pageableCollection,
  insertOrUpdateEntity,
};
