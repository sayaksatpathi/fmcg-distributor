const path = require('path');
require('dotenv').config();

module.exports = {
    development: {
        client: 'sqlite3',
        connection: {
            filename: process.env.DB_PATH || path.resolve(__dirname, 'distributor.db')
        },
        useNullAsDefault: true,
        migrations: {
            directory: path.join(__dirname, 'src/db/migrations')
        },
        seeds: {
            directory: path.join(__dirname, 'src/db/seeds')
        },
        pool: {
            afterCreate: (conn, cb) => {
                conn.run('PRAGMA foreign_keys = ON', cb);
            }
        }
    },

    production: {
        client: 'sqlite3',
        connection: {
            filename: process.env.DB_PATH || path.resolve(__dirname, 'distributor.db')
        },
        useNullAsDefault: true,
        migrations: {
            directory: path.join(__dirname, 'src/db/migrations')
        },
        pool: {
            afterCreate: (conn, cb) => {
                conn.run('PRAGMA foreign_keys = ON', cb);
            }
        }
    }
};
