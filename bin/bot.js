require('dotenv').config({ silent: true });
const NorrisBot = require('../lib/norrisbot');

const token = process.env.BOT_API_KEY;
const dbPath = process.env.BOT_DB_PATH;
const name = process.env.BOT_NAME;

const norrisbot = new NorrisBot({ token, dbPath, name });

norrisbot.run();
