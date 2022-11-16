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

        // bookings collection
        const bookingsCollection = database.collection('bookingsCollection');

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
