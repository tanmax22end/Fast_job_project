const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let Cred = new Schema({
    host_id: {
        type: String
    },
    credentials: {
        access_token: {
            type: String
        },
        scope: {
            type: String
        },
        token_type: {
            type: String
        },
        expiry_date: {
            type: Number
        }
    }
});

module.exports = mongoose.model('Cred', Cred);