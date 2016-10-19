const path = require('path');
const fs = require('fs');
const SQLite = require('sqlite3').verbose();
const Bot = require('slackbots');

function isChatMessage(message) {
    return message.type === 'message' && Boolean(message.text);
}

function isChannelConversation(message) {
    return typeof message.channel === 'string' &&
        message.channel[0] === 'C';
}

module.exports = class NorrisBot extends Bot {
    constructor({ token, dbPath, name = 'norrisbot' }) {
        super({ token, name });

        this.name = name;
        this.dbPath = dbPath || path.resolve(process.cwd(), 'data', 'norrisbot.db');

        this.user = null;
        this.db = null;
    }

    run() {
        this.on('start', this.onStart);
        this.on('message', this.onMessage);
    }

    onStart() {
        this.loadBotUser();
        this.connectDb();
        this.firstRunCheck();
    }

    loadBotUser() {
        this.user = this.users.filter(user => user.name === this.name)[0];
    }

    connectDb() {
        if (!fs.existsSync(this.dbPath)) {
            console.error(`Database path "${this.dbPath}" does not exists or it's not readable.`);
            process.exit(1);
        }

        this.db = new SQLite.Database(this.dbPath);
    }

    firstRunCheck() {
        this.db.get('SELECT val FROM info WHERE name = "lastrun" LIMIT 1', (err, record) => {
            if (err) {
                console.error('DATABASE ERROR:', err);
                return;
            }

            const currentTime = (new Date()).toJSON();

            // this is a first run
            if (!record) {
                this.welcomeMessage();
                this.db.run('INSERT INTO info(name, val) VALUES("lastrun", ?)', currentTime);
                return;
            }

            // updates with new last running time
            this.db.run('UPDATE info SET val = ? WHERE name = "lastrun"', currentTime);
        });
    }

    welcomeMessage() {
        this.postMessageToChannel(
            this.channels[0].name,
            `Hi guys, roundhouse-kick anyone?\nI can tell jokes, but very honest ones. Just say \`Chuck Norris\` or \`${this.name}\` to invoke me!`,
            { as_user: true }
        );
    }

    onMessage(message) {
        if (isChatMessage(message) &&
            isChannelConversation(message) &&
            !this.isFromNorrisBot(message) &&
            this.isMentioningChuckNorris(message)
        ) {
            this.replyWithRandomJoke(message);
        }
    }

    isFromNorrisBot(message) {
        return message.user === this.user.id;
    }

    isMentioningChuckNorris(message) {
        return message.text.toLowerCase().indexOf('chuck norris') > -1 ||
            message.text.toLowerCase().indexOf(this.name) > -1;
    }

    replyWithRandomJoke(originalMessage) {
        this.db.get('SELECT id, joke FROM jokes ORDER BY used ASC, RANDOM() LIMIT 1', (err, record) => {
            if (err) {
                console.error('DATABASE ERROR:', err);
                return;
            }

            const channel = this.getChannelById(originalMessage.channel);
            this.postMessageToChannel(channel.name, record.joke, { as_user: true });
            this.db.run('UPDATE jokes SET used = used + 1 WHERE id = ?', record.id);
        });
    }

    getChannelById(channelId) {
        return this.channels.filter(item => item.id === channelId)[0];
    }
};
