import express from "express";
import cors from "cors";
import Joi from "joi";
import dayjs from "dayjs";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => {
  db = mongoClient.db("database_UOL");
});

const server = express();
server.use(express.json());
server.use(cors());

const schema = Joi.object({
  name: Joi.string().alphanum().min(3).max(16).required(),
});

server.post("/participants", async (req, res) => {
  try {
    const { name } = await schema.validateAsync(req.body);
    const findOne = await db.collection("users").findOne({ name });
    if (!findOne) {
      db.collection("users").insertOne({
        name,
        lastStatus: Date.now(),
      });
      db.collection("messages").insertOne({
        from: name,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: dayjs().format("hh:mm:ss"),
      });
      return res.send(201);
    } else {
      return res.sendStatus(409);
    }
  } catch (err) {
    return res.sendStatus(422);
  }
});

server.listen(5000);
