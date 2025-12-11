require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 3000;

const app = express();

app.use(cors());
app.use(express.json());

const uri = process.env.mongoDB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db("assignment11");
    const tuitionsCollection = db.collection("tuitions");

    app.post("/tuitions", async (req, res) => {
      const tuitions = req.body;
      const result = await tuitionsCollection.insertOne(tuitions);
      res.send(result);
    });

    app.get("/tuitions", async (req, res) => {
      const result = await tuitionsCollection.find().toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hallo From Server....");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
