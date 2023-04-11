const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let Slots = new Schema({
    host_id: {
        type: String
    },
    details: [{
        start_time: {
            type: String
        },
        end_time: {
            type: String
        },
        status: {
            type: Boolean
        }
    }]
});

module.exports = mongoose.model('Slots', Slots);