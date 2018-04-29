const express = require('express');

const app = express();
const http = require('http').Server(app);
const path = require('path');
const attachIO = require('socket.io');
const cookieParser = require('socket.io-cookie-parser');
const cookie = require('cookie-parser');
const uuid = require('uuid/v4');

const { connect } = require('./database');
const attachController = require('./controller');

/**
 * @param {{}} serverConfig
 * @param {string} serverConfig.host Server host
 * @param {number} serverConfig.port Server port
 *
 * @param {MongoConfig} databaseConfig
 *
 * @return {Promise<void>}
 */
// eslint-disable-next-line func-names
function createServer (serverConfig, databaseConfig) {
  return connect(databaseConfig).then(db => new Promise((resolve) => {
    app.use(cookie());

    app.use(express.static(path.join(__dirname, '../../build')));

    app.use('/api/auth', (req, res) => {
      if (!req.cookies.sid) {
        res.cookie('sid', uuid(), {
          httpOnly: true,
          path: '/',
          maxAge: 24 * 7 * 3600000, // 1 week
        });
      }

      res.json({});
    });

    const io = attachIO(http);

    io.use(cookieParser());

    attachController(db, io);

    app.use('/*', express.static(path.join(__dirname, '../../build/index.html')));

    http.listen(serverConfig.port, () => {
      // eslint-disable-next-line no-console
      console.log(`API server listen at http://${serverConfig.host}:${serverConfig.port}`);

      resolve();
    });
  }));
};

createServer({ port: process.env.port || 8080 }, {
  database: 'deo-iuvante',
});
