import { MongoClient } from "mongodb";
import { CONFIG } from "../config";

const {
  URL,
  USER,
  PASSWORD,
} = CONFIG.MONGODB;

let client;
let clientPromise: Promise<MongoClient>;

const connectionString = `mongodb://${USER}:${PASSWORD}@${URL}`;

client = new MongoClient(connectionString, {});
clientPromise = client.connect();

export default clientPromise;