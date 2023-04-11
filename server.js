// Import required dependencies using require statement
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const { google } = require('googleapis');
require('dotenv').config();


// console.log(google)

// Create an instance of Express
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
client.connect(err => {
    const collection = client.db("test").collection("devices");
    // perform actions on the collection object
    client.close();
});

mongoose.connect(uri, { useNewUrlParser: true });
// mongoose.connect('mongodb://127.0.0.1:27017/youtube_links', { useNewUrlParser: true });
const connection = mongoose.connection;
connection.once('open', function () {
    console.log("MongoDB database connection established successfully");
})

let Slots = require('./src/slot_model');

let Cred = require('./src/cred_model');


const oAuth2Client = new google.auth.OAuth2({
    clientId:  process.env.CLIENT_ID ,
    clientSecret: process.env.CLIENtT_SECRET,
    redirectUri: 'http://localhost:3000'
});
// console.log(process.env.CLIENtT_SECRET);
//console.log(oAuth2Client);
//// Generate the authorization URL
const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
});
// console.log(authUrl);
//oAuth2Client.getToken(authorizationCode, (err, tokens) => {
//    if (err) {
//        console.error('Error getting access token:', err);
//        return;
//    }
    // Set the credentials on the OAuth2 client
//    oAuth2Client.setCredentials(tokens);

////    // Now you can use the `google` object to make API requests
////    // Use the `calendar` object to make API requests
//});


app.get('/', async (req, res) => {
    const authorizationCode = req.query.code;
    oAuth2Client.getToken(authorizationCode, async (err, tokens) => {
        if (err) {
            console.error('Error getting access token:', err);
            // Handle error
        } else {
            // Set the credentials on the OAuth2 client
            oAuth2Client.setCredentials(tokens);
    //        console.log(tokens);
        }
    });
    res.send("hello world");
});


app.post('/add', async function (req, res) {
    const { host_id, details } = req.body;

    try {
        const existingHost = await Slots.findOne({ host_id });
        if (existingHost) {
            // If host exists, append slots to the existing host
        //    existingHost.details.push(...details);
                existingHost.details.push(details);
            const updatedHost = await existingHost.save();
            res.json(updatedHost);
        } else {
            // If host does not exist, create a new host with the slots
            res.redirect(authUrl);
            const newHost = new Slots({ host_id, details });
            const savedHost = await newHost.save();
            res.json(savedHost);
        }
    } catch (err) {
        console.error("Error adding new slot:", err);
        res.status(400).send('Adding new slot failed');
    }
});
app.get('/availability/:hostId', async(req, res) =>
{
    const hostId = req.params.hostId;

    try {
        // Use the Host model to find the host by host_id
        const host = await Slots.findOne({ host_id: hostId });

        if (!host) {
            res.status(404).json({ error: 'Host not found' });
            return;
        }
        const availableSlots = host.details
            .filter(slot => !slot.status)
            .map(slot => ({start_time: slot.start_time, end_time: slot.end_time}));

        // Return the available slots as response
        res.json({ availableSlots });
    } catch (error) {
        console.error('Error fetching availability from MongoDB:', error);
        res.status(500).json({ error: 'Failed to fetch availability' });
    }
});

app.post('/meet', async function (req, res) {
    const { host_id, user_id, start_time, end_time, summary, location } = req.body;
    try {
        // Find the host by host_id
        const host = await Slots.findOne({ host_id: host_id });

        if (!host) {
            res.status(404).json({ error: 'Host not found' });
            return;
        }

        // Find the user by user_id
        const user = await Slots.findOne({ host_id: user_id });

        if (!user) {
            res.redirect(authUrl);
            const host_id = user_id;
            const credentials = oAuth2Client.credentials;
            const cred = new Cred({ host_id, credentials });
            const details = {};
            const savedcred = await cred.save();
            console.log(savedcred);
            const newHost = new Slots({ host_id, details });
            const savedHost = await newHost.save();
            res.json(savedHost);
            console.log(savedcred);
        }
        console.log(host);
    //    console.log(start_time);
    //    console.log(end_time);
        // Check if the requested time slot is available
        const requestedSlot = host.details.find(slot => slot.start_time === start_time && slot.end_time === end_time);
    //    console.log(requestedSlot);
        if (!requestedSlot || requestedSlot.status) {
            console.log(requestedSlot);
            res.status(400).json({ error: 'Requested time slot is not available' });
            return;
        }
        // Update the status of the requested slot to booked
        const host_token = await Cred.findOne({ host_id: host_id });
        const user_token = await Cred.findOne({ host_id: user_id });

        oAuth2Client.setCredentials(host_token.credentials);
        console.log(host_token.credentials);

        const calendar_host = google.calendar({ version: 'v3', auth: oAuth2Client });

        const event = {
            summary: summary,
            location: location,
            start: {
                dateTime: start_time, // Event start time in IST
                timeZone: 'Asia/Kolkata', // Event time zone set to IST
            },
            end: {
                dateTime: end_time, // Event end time in IST
                timeZone: 'Asia/Kolkata', // Event time zone set to IST
            },
            // You can add more properties to the event, such as attendees, reminders, etc.
        };
        calendar_host.events.insert({ calendarId: 'primary', resource: event }, (err, res) => {
            if (err) {
                console.error('Error creating event:', err);
                return;
            }
            console.log('Event created:', res.data.htmlLink);
        });

        oAuth2Client.setCredentials(user_token.credentials);
        console.log(user_token.credentials);

        const calendar_user = google.calendar({ version: 'v3', auth: oAuth2Client });

        calendar_user.events.insert({ calendarId: 'primary', resource: event }, (err, res) => {
            if (err) {
                console.error('Error creating event:', err);
                return;
            }
            console.log('Event created:', res.data.htmlLink);
        });

        requestedSlot.status = true;
        // Save the updated host and user to the database
        await host.save();
        user.details.push({ "start_time": start_time, "end_time": end_time, "status": true });
        await user.save();
        res.status(200).json("meet is scheduled");

    } catch (err) {
        console.error('Error booking meeting:', err);
        res.status(500).json({ error: 'Failed to book meeting' });
    }
})

//module.exports = app;

const port = process.env.PORT || 3000; // Use the port number from environment variable or fallback to 3000
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

// Start the server
//const port = 3000;
//app.listen(port, () => {
//    console.log(`Server is running on http://localhost:${port}`);
//});
