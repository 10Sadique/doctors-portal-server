const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());
const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized Access!!' });
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' });
        }
        req.decoded = decoded;
        next();
    });
};

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
        // bookings collection
        const bookingsCollection = database.collection('bookingsCollection');
        // user collection
        const userCollection = database.collection('users');

        // get all appointment options
        // Use Aggregate to query multiple collection and then merge data
        app.get('/appointmentOptions', async (req, res) => {
            const date = req.query.date;
            const query = {};
            const options = await appointmentOptionsCollection
                .find(query)
                .toArray();

            // get the bookings of provided date
            const bookingQuery = { appointmentDate: date };
            const alreadyBooked = await bookingsCollection
                .find(bookingQuery)
                .toArray();

            // remove slots for booked options
            options.forEach((option) => {
                const optionBooked = alreadyBooked.filter(
                    (book) => book.treatment === option.name
                );
                const bookedSlots = optionBooked.map((book) => book.slot);
                const remainingSlots = option.slots.filter(
                    (slot) => !bookedSlots.includes(slot)
                );

                option.slots = remainingSlots;
            });

            res.send(options);
        });

        app.get('/v2/appointmentOptions', async (req, res) => {
            const date = req.query.date;
            const options = await appointmentOptionsCollection
                .aggregate([
                    {
                        $lookup: {
                            from: 'bookingsCollection',
                            localField: 'name',
                            foreignField: 'treatment',

                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $eq: ['$appointmentDate', date],
                                        },
                                    },
                                },
                            ],
                            as: 'booked',
                        },
                    },
                    {
                        $project: {
                            name: 1,
                            slots: 1,
                            booked: {
                                $map: {
                                    input: '$booked',
                                    as: 'book',
                                    in: '$$book.slot',
                                },
                            },
                        },
                    },
                    {
                        $project: {
                            name: 1,
                            slots: {
                                $setDifference: ['$slots', '$booked'],
                            },
                        },
                    },
                ])
                .toArray();

            res.send(options);
        });

        // get bookings
        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;

            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }
            const query = {
                email: email,
            };
            const bookings = await bookingsCollection.find(query).toArray();

            res.send(bookings);
        });

        // post bookings
        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const query = {
                appointmentDate: booking.appointmentDate,
                treatment: booking.treatment,
                email: booking.email,
            };

            const alreadyBooked = await bookingsCollection
                .find(query)
                .toArray();

            if (alreadyBooked.length) {
                const message = `You already have a booking on ${booking.appointmentDate}`;

                return res.send({ acknowledged: false, message });
            }

            const result = await bookingsCollection.insertOne(booking);

            res.send(result);
        });

        // get users
        app.get('/users', async (req, res) => {
            const query = {};
            const users = await userCollection.find(query).toArray();

            res.send(users);
        });

        // post users
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user);

            res.send(result);
        });

        // get admin users
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            res.send({
                isAdmin: user?.role === 'admin',
            });
        });

        // put admin user
        app.put('/users/admin/:id', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await userCollection.find(query);

            if (user?.role !== 'adimn') {
                return res.status(403).send({
                    message: 'forbidden access',
                });
            }

            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin',
                },
            };
            const options = { upsert: true };
            const result = await userCollection.updateOne(
                filter,
                updatedDoc,
                options
            );

            res.send(result);
        });

        // get jwt
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);

            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
                    expiresIn: '1h',
                });

                return res.send({ accessToken: token });
            }

            res.status(403).send({
                accessToken: '',
            });
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
