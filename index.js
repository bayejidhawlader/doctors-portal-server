// 01 Basic Setup
const express = require("express");

// 02.1 Connect Mongo Db Application to Server
const { MongoClient, ServerApiVersion } = require("mongodb");

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
    app.get("/AppoinmentOptions", async (req, res) => {
      const query = {};
      const options = await appoinmentOptionCollection.find(query).toArray();
      res.send(options);
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
app.listen(port, () => console.log(`Doctors Portall Running on ${port}`));
