require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
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
    const applicationsCollection = db.collection("applications");
    const paymentCollection = db.collection("payment");
    const usersCollection = db.collection("users");

    // application related api
    app.get("/applications", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.studentEmail = email;
      }
      const result = await applicationsCollection.find(query).toArray();
      res.send(result);
    });

    // latest issue get
    app.get("/latest-applications", async (req, res) => {
      const result = await applicationsCollection
        .find()
        .limit(6)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    app.post("/applications", async (req, res) => {
      const applicationData = req.body;
      console.log(applicationData);
      const result = await applicationsCollection.insertOne(applicationData);
      res.send(result);
    });

    app.patch("/applications/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "rejected",
        },
      };
      const result = await applicationsCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // tuition related api
    app.get("/tuitions", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.email = email;
      }

      const result = await tuitionsCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    app.get("/tuitions/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await tuitionsCollection.findOne(query);
      res.send(result);
    });

    app.post("/tuitions", async (req, res) => {
      const tuitions = req.body;
      tuitions.status = "pending";
      tuitions.createdAt = new Date();
      const result = await tuitionsCollection.insertOne(tuitions);
      res.send(result);
    });

    app.patch("/tuitions/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "approved",
        },
      };
      const result = await tuitionsCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    app.delete("/tuitions/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await tuitionsCollection.deleteOne(query);
      res.send(result);
    });

    // users related api
    app.post("/users", async (req, res) => {
      const user = req.body;
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

    app.get("/users", async (req, res) => {
      const searchText = req.query.searchText;
      const query = {};
      if (searchText) {
        query.$or = [
          { name: { $regex: searchText, $options: "i" } },
          { email: { $regex: searchText, $options: "i" } },
        ];
      }
      const result = await usersCollection
        .find(query)
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();
      res.send(result);
    });

    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await usersCollection.findOne(query);
      res.send({ role: result?.role || "student" });
    });

    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const userInfo = req.body;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: userInfo.role,
        },
      };
      const result = await usersCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // payment related api
    app.get("/payment", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.studentEmail = email;
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      // console.log(paymentInfo);
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: paymentInfo?.tutorName,
                images: [paymentInfo?.tutorPhoto],
              },
              unit_amount: paymentInfo?.expectedSalary * 100,
            },
            quantity: 1,
          },
        ],
        customer_email: paymentInfo?.student?.studentEmail,
        mode: "payment",
        metadata: {
          tuitionId: paymentInfo?.tuitionId,
          applicationId: paymentInfo?.applicationId,
          student: paymentInfo?.student?.studentEmail,
        },
        success_url: `${process.env.CLIENT_URL}/success-url?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/dashboard/student/applied-tutors`,
      });
      res.send({ url: session.url });
    });

    app.post("/payment-success", async (req, res) => {
      const { sessionId } = req.body;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      // console.log(session);
      const tuition = await applicationsCollection.findOne({
        _id: new ObjectId(session.metadata.applicationId),
      });
      const payment = await paymentCollection.findOne({
        transactionId: session.payment_intent,
      });
      // console.log(tuition);
      if (session.status === "complete" && tuition && !payment) {
        const successInfo = {
          tuitionId: session.metadata.tuitionId,
          transactionId: session.payment_intent,
          studentEmail: session.customer_email,
          amount: session.amount_total / 100,
          tutorName: tuition.tutorName,
          tutorEmail: tuition.tutorEmail,
          applicationId: tuition._id,
          status: "success",
          paymentAt: new Date(),
        };
        // console.log(successInfo);
        const result = await paymentCollection.insertOne(successInfo);
        // update tutor status
        await applicationsCollection.updateOne(
          { _id: new ObjectId(session.metadata.applicationId) },
          { $set: { status: "approved" } }
        );
        return res.send({
          transactionId: session.payment_intent,
          orderId: result.insertedId,
        });
      }
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
