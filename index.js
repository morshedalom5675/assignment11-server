require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    const usersCollection = db.collection("users");

    app.post("/tuitions", async (req, res) => {
      const tuitions = req.body;
      const result = await tuitionsCollection.insertOne(tuitions);
      res.send(result);
    });

    app.get("/tuitions", async (req, res) => {
      // const email = req.params
      // console.log(email)
      const result = await tuitionsCollection.find().toArray();
      res.send(result);
    });

    app.get("/tuitions/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await tuitionsCollection.findOne(query);
      res.send(result);
    });

    // users related api
    app.post("/users", async (req, res) => {
      const user = req.body;
      user.role = "student";
      user.createdAt = new Date();
      const existingUser = await usersCollection.findOne({
        email: user.email,
      });
      if (existingUser) {
        return res.send({ message: "user is already exist" });
      }
      const result = await usersCollection.insertOne(user);
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
