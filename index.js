// 17, 18(255), 19, 20(Stripe), 21(Stripe, 221) 22(Payment Collection 74, 242 (checkoutForm 74) )

// 01 Basic Setup
const express = require("express");
require("dotenv").config();

// 10 Json Web Token
const jwt = require("jsonwebtoken");

// 20 Require STRIPE key
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// 02.1 Connect Mongo Db Application to Server
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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
  console.log(authHeader);
  const token = authHeader.split(" ")[1];
  // console.log(token);

  // 13 Verify Token
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    console.log(err, decoded);
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

    // 15 for Doctors Collection http://localhost:3000/dashboard/adddoctor
    const doctorsCollection = client.db("doctorsPortal").collection("doctors");

    // 22 Collection for Payments ('/' 282)
    const paymentsCollection = client
      .db("doctorsPortal")
      .collection("payments");

    // 18 Verify Admin after Deleted Admin Manage Doctors Page (Make sure you use verifyAdmin agter verifyJWT)
    const verifyAdmin = async (req, res, next) => {
      // console.log("Inside very Admin", req.decoded.email);
      const decoded = req.decoded.email;
      const query = { email: decoded };
      const user = await usersCollection.findOne(query);

      if (user.role !== "admin") {
        return res.status(403).send({ message: "forbidenn access" });
      }
      // res.decoded = req.decoded;
      next();
    };

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

    // 15 http://localhost:3000/dashboard/adddoctor add a doctor Speciality Dropdown
    app.get("/appoinmentSpecialty", async (req, res) => {
      const query = {};
      const result = await appoinmentOptionCollection
        .find(query)
        .project({ name: 1 })
        .toArray();
      res.send(result);
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

    // 19 for Payment page with Dynamic id http://localhost:3000/dashboard/payment
    app.get("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const booking = await bookingsCollection.findOne(query);
      res.send(booking);
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

    // 21 Stripe Payment create-payment-intent (CheckoutForm 10)
    app.post("/create-payment-intent", async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // 22 Collection for Payments
    // app.post("/payments", async (req, res) => {
    //   const payment = req.body;
    //   const result = await paymentsCollection.insertOne(payment);
    //   const _id = payment.bookingId;
    //   const flter = { _id: ObjectId(id) };
    //   const updatedDoc = {
    //     $set: {
    //       paid: true,
    //       transactionId: payment.transactionId,
    //     },
    //   };
    //   const updatedResult = await bookingsCollection.updateOne(
    //     filter,
    //     updatedDoc
    //   );
    //   res.send(result);
    // });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      const id = payment.bookingId;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const updatedResult = await bookingsCollection.updateOne(
        filter,
        updatedDoc
      );
      console.log(result);
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

    // 14 Check user they are Admin or not
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
    app.put("/users/admin/:id", verifyJwt, verifyAdmin, async (req, res) => {
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

    // 18 Temporary to update price field on appoinment option
    // app.get("/addPrice", async (req, res) => {
    //   const filter = {};
    //   const options = { upsert: true };
    //   const updatedDoc = {
    //     $set: {
    //       price: 99,
    //     },
    //   };
    //   const result = await appoinmentOptionCollection.updateMany(
    //     filter,
    //     updatedDoc,
    //     options
    //   );
    //   res.send(result);
    // });

    // 09
    app.post("/users", async (req, res) => {
      const user = req.body;
      // console.log(user);
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // 16 Show all Doctors to ManageDoctors Page http://localhost:3000/dashboard/managedoctors
    app.get("/doctors", verifyJwt, async (req, res) => {
      const query = {};
      const doctors = await doctorsCollection.find(query).toArray();
      res.send(doctors);
    });

    // 15.0 for Doctors Collection
    app.post("/doctors", verifyJwt, verifyAdmin, async (req, res) => {
      const doctor = req.body;
      const result = await doctorsCollection.insertOne(doctor);
      res.send(result);
    });

    // 17 Manage Doctor Page, Doctor Delete
    app.delete("/doctors/:id", verifyJwt, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await doctorsCollection.deleteOne(filter);
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
