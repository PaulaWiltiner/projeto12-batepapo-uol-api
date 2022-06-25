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
  db = mongoClient.db("databaseUOL");
});

const server = express();
server.use(express.json());
server.use(cors());

const userSchema = (user) =>
  Joi.object({
    name: Joi.string().required(),
  }).validateAsync(user);

const messageSchema = async (to, text, type, from) => {
  const findOne = await db.collection("participants").findOne({ name: from });
  const name = findOne ? findOne.name : findOne.name + "NO";
  return Joi.object({
    to: Joi.string().required(),
    text: Joi.string().required(),
    type: Joi.string().valid("private_message", "message").required(),
    from: Joi.string().valid(name).required(),
  }).validateAsync({ to, text, type, from });
};

server.post("/participants", async (req, res) => {
  try {
    const { name } = await userSchema(req.body);
    const findOne = await db.collection("participants").findOne({ name });
    if (!findOne) {
      db.collection("participants").insertOne({
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
      return res.sendStatus(201);
    } else {
      return res.sendStatus(409);
    }
  } catch (err) {
    return res.sendStatus(422);
  }
});

server.get("/participants", async (req, res) => {
  const listParticipants = await db
    .collection("participants")
    .find({})
    .toArray();
  return res.send(listParticipants);
});

server.post("/messages", async (req, res) => {
  try {
    const { to, text, type, from } = await messageSchema(
      req.body.to,
      req.body.text,
      req.body.type,
      req.headers.user
    );
    await db.collection("messages").insertOne({
      from: from,
      to: to,
      text: text,
      type: type,
      time: dayjs().format("hh:mm:ss"),
    });
    return res.sendStatus(201);
  } catch (err) {
    return res.sendStatus(422);
  }
});

server.get("/participants", async (req, res) => {
  const listParticipants = await db
    .collection("participants")
    .find({})
    .toArray();
  return res.send(listParticipants);
});

server.get("/messages", async (req, res) => {
  const limit = req.query.limit;
  const { user } = req.headers;
  const list = await db.collection("messages").find({}).toArray();
  const listMsg = await list.filter(
    (item) => !(item.type === "private_message" && item.from !== user)
  );
  const listMessages = listMsg.reverse();
  if (!limit || limit >= listMessages.length) {
    return res.send(listMessages);
  } else {
    const newListMessages = listMessages.slice(0, limit);
    return res.send(newListMessages);
  }
});

server.post("/status", async (req, res) => {
  const { user } = req.headers;
  const findOne = await db.collection("participants").findOne({ name: user });
  console.log(findOne);
  if (findOne) {
    await db.collection("participants").updateOne(
      {
        lastStatus: findOne.lastStatus,
      },
      { $set: { lastStatus: Date.now() } }
    );
    return res.sendStatus(201);
  } else {
    return res.sendStatus(404);
  }
});

async function removePartcipant() {
  const listParticipants = await db
    .collection("participants")
    .find({})
    .toArray();

  console.log(listParticipants);
  listParticipants.forEach((item) => {
    const second = Date.now() - item.lastStatus;
    if (second > 10) {
      db.collection("messages").insertOne({
        from: item.name,
        to: "Todos",
        text: "sai da sala...",
        type: "status",
        time: dayjs().format("hh:mm:ss"),
      });
      db.collection("participants").deleteOne({
        name: item.name,
      });
    }
  });
}

setInterval(removePartcipant, 15000);

server.listen(5000);
