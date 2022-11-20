// 01 Basic Setup
const express = require("express");

// 10 Json Web Token
const jwt = require("jsonwebtoken");

// 02.1 Connect Mongo Db Application to Server
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

// 01.0 Basic Setup
const cors = require("cors");
const port = process.env.PORT || 5000;

// 01.1 Basic Setup
const app = express();

// 01.2 Basic Setup
// Middle Ware
app.use(cors());
app.use(express.json());

// 02 Connect Mongo Db Application to Server

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.athiem3.mongodb.net/?retryWrites=true&w=majority`;

// 12 Verufy Jwt
function verifyJwt(req, res, next) {
  // console.log("Token inside vrify JWT", req.headers.authorization);
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("UnAuthorized Access");
  }

  const token = authHeader.split("")[1];

  // 13 Verify Token
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
}

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// 03 Find Multiple Documents
async function run() {
  try {
    const appoinmentOptionCollection = client
      .db("doctorsPortal")
      .collection("AppoinmentOptions");
    // 04 Appoinment Modal sumbit mongodb database received
    const bookingsCollection = client
      .db("doctorsPortal")
      .collection("bookings");
    const usersCollection = client.db("doctorsPortal").collection("users");

    // Use AgreeGet to query t miltiple collection and then merge data
    app.get("/AppoinmentOptions", async (req, res) => {
      const date = req.query.date;
      console.log(date);
      const query = {};
      const options = await appoinmentOptionCollection.find(query).toArray();

      // 05 Get the Booking of tthe Provided Date
      const bookingQuery = { appoinmentData: date };
      const alreadyBooked = await bookingsCollection
        .find(bookingQuery)
        .toArray();

      // Code Carefully
      options.forEach((option) => {
        const optionBooked = alreadyBooked.filter(
          (book) => book.tretment === option.name
        );
        const bookedSlots = optionBooked.map((book) => book.slot);

        // 06 Remainning Slots
        const remainningSlots = option.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        option.slots = remainningSlots;
        // console.log(date, option.name, remainningSlots.length);
      });
      res.send(options);
    });

    // 07 Aggragate $lookup
    app.get("/v2/AppoinmentOptions", async (req, res) => {
      const date = req.query.data;
      const options = await appoinmentOptionCollection
        .aggregate([
          {
            $lookup: {
              from: "bookings",
              localField: "name",
              foreignField: "tretment",
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ["$appoinmentData", date],
                    },
                  },
                },
              ],
              as: "booked",
            },
          },
          {
            $project: {
              name: 1,
              slots: 1,
              booked: {
                $map: {
                  input: "$booked",
                  as: "book",
                  in: "$$book.slot",
                },
              },
            },
          },
          {
            $project: {
              name: 1,
              slots: {
                $setDifference: ["$slots", "$booked"],
              },
            },
          },
        ])
        .toArray();
      res.send(options);
    });

    // 08 My Appointment showing on Dashboard Page
    app.get("/bookings", verifyJwt, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;

      if (email !== decodedEmail) {
        return res.status(403).send({ message: "forbidden access" });
      }

      // console.log("Token", req.headers.authorization);
      const query = { email: email };
      const bookings = await bookingsCollection.find(query).toArray();
      res.send(bookings);
    });

    // 04.0 Appoinment Modal sumbit mongodb database received
    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const query = {
        appoinmentData: booking.appoinmentData,
        email: booking.email,
        tretment: booking.tretment,
      };

      const alreadyBooked = await bookingsCollection.find(query).toArray();

      // if (alreadyBooked.length) {
      //   const message = `You already have a booking on ${booking.appoinmentData}`;
      //   return res.send({ acknowledged: false, message });
      // }

      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    // 11 Create new jwt token for login with google
    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "1h",
        });
        return res.send({ accessToken: token });
      }

      res.status(403).send({ accessToken: "" });
    });

    // 13 Check user they are Admin or not
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });

    // 12 allUsers
    app.get("/users", async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    // 13 Make user Admin
    app.put("/users/admin/:id", verifyJwt, async (req, res) => {
      const decoded = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);

      if (user.role !== "admin") {
        return res.status(403).send({ message: "forbidenn access" });
      }

      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    // 09
    app.post("/users", async (req, res) => {
      const user = req.body;
      // console.log(user);
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.log);

// 01.3 Basic Setup
app.get("/", async (req, res) => {
  res.send("Doctors Portal server is running");
});
// 01.4 Basic Setup
app.listen(port, () => console.log(`Doctors Portal Running on ${port}`));
