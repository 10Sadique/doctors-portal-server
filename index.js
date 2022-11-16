const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());

// MongoDB setup
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.onfc57d.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
});

// mongdb data fetching
async function run() {
    try {
        const database = client.db('doctorsPortal');

        // appointment options collection
        const appointmentOptionsCollection =
            database.collection('appointmentOptions');

        // get appointment options
        app.get('/appointmentOptions', async (req, res) => {
            const query = {};
            const options = await appointmentOptionsCollection
                .find(query)
                .toArray();

            res.send(options);
        });
    } finally {
    }
}

run().catch((err) => console.log(err));

// root ('/') endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Doctors Portal Server',
    });
});

// listen server
app.listen(port, () => {
    console.log(`Listening to port ${port}`);
});
