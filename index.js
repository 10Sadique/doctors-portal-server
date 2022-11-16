const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());

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
