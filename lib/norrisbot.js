const util = require('util');
const path = require('path');
const fs = require('fs');
const SQLite = require('sqlite3').verbose();
const Bot = require('slackbots');

const NorrisBot = function Constructor(settings) {
    this.settings = settings;
    this.settings.name = this.settings.name || 'norrisbot';
    this.dbPath = settings.dbPath || path.resolve(process.cwd(), 'data', 'norrisbot.db');

    this.user = null;
    this.db = null;
};

NorrisBot.prototype.run = function run() {
    NorrisBot.super_.call(this, this.settings); // eslint-disable-line no-underscore-dangle

    this.on('start', this.onStart);
    this.on('message', this.onMessage);
};

NorrisBot.prototype.onStart = function onStart() {
    this.loadBotUser();
    this.connectDb();
    this.firstRunCheck();
};

NorrisBot.prototype.loadBotUser = function loadBotUser() {
    const self = this;

    this.user = this.users.filter(user =>
        user.name === self.name
    )[0];
};

NorrisBot.prototype.connectDb = function connectDb() {
    if (!fs.existsSync(this.dbPath)) {
        console.error(`Database path "${this.dbPath}" does not exists or it's not readable.`);
        process.exit(1);
    }

    this.db = new SQLite.Database(this.dbPath);
};

NorrisBot.prototype.firstRunCheck = function firstRunCheck() {
    const self = this;

    self.db.get('SELECT val FROM info WHERE name = "lastrun" LIMIT 1', (err, record) => {
        if (err) {
            console.error('DATABASE ERROR:', err);
            return;
        }

        const currentTime = (new Date()).toJSON();

        // this is a first run
        if (!record) {
            self.welcomeMessage();
            self.db.run('INSERT INTO info(name, val) VALUES("lastrun", ?)', currentTime);
            return;
        }

        // updates with new last running time
        self.db.run('UPDATE info SET val = ? WHERE name = "lastrun"', currentTime);
    });
};

NorrisBot.prototype.welcomeMessage = function welcomeMessage() {
    this.postMessageToChannel(
        this.channels[0].name,
        `Hi guys, roundhouse-kick anyone?\n I can tell jokes, but very honest ones. Just say \`Chuck Norris\` or \`${this.name}\` to invoke me!`,
        { as_user: true }
    );
};

NorrisBot.prototype.onMessage = function onMessage(message) {
    if (this.isChatMessage(message) &&
        this.isChannelConversation(message) &&
        !this.isFromNorrisBot(message) &&
        this.isMentioningChuckNorris(message)
    ) {
        this.replyWithRandomJoke(message);
    }
};

NorrisBot.prototype.isChatMessage = function isChatMessage(message) {
    return message.type === 'message' && Boolean(message.text);
};

NorrisBot.prototype.isChannelConversation = function isChannelConversation(message) {
    return typeof message.channel === 'string' &&
        message.channel[0] === 'C';
};

NorrisBot.prototype.isFromNorrisBot = function isFromNorrisBot(message) {
    return message.user === this.user.id;
};

NorrisBot.prototype.isMentioningChuckNorris = function isMentioningChuckNorris(message) {
    return message.text.toLowerCase().indexOf('chuck norris') > -1 ||
        message.text.toLowerCase().indexOf(this.name) > -1;
};

NorrisBot.prototype.replyWithRandomJoke = function replyWithRandomJoke(originalMessage) {
    const self = this;

    self.db.get('SELECT id, joke FROM jokes ORDER BY used ASC, RANDOM() LIMIT 1', (err, record) => {
        if (err) {
            console.error('DATABASE ERROR:', err);
            return;
        }

        const channel = self.getChannelById(originalMessage.channel);
        self.postMessageToChannel(channel.name, record.joke, { as_user: true });
        self.db.run('UPDATE jokes SET used = used + 1 WHERE id = ?', record.id);
    });
};

NorrisBot.prototype.getChannelById = function getChannelById(channelId) {
    return this.channels.filter(item =>
        item.id === channelId
    )[0];
};

// inherits methods and properties from the Bot constructor
util.inherits(NorrisBot, Bot);

module.exports = NorrisBot;
