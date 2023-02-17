const dotenv = require("dotenv");
const amqp = require("amqplib");
const mysql = require("mysql2/promise");

dotenv.config();

const dbConfig = {
  host: (process.env.DB_HOST === "prod") ? process.env.DB_HOST : "localhost",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
};

async function connectToDb() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    console.warn("Connected to database.");
    return connection;
  } catch (error) {
    throw error;
  }
}

async function sendEndpoint(data) {
  const connection = await amqp.connect((process.env.ENV == "prod") ? process.env.AMQP_URL : "amqp://localhost:5672");
  const channel = await connection.createChannel();
  await channel.sendToQueue("endpoint-queue", Buffer.from(JSON.stringify(data)));
  console.warn(`${data.phone} is processed and sent to the endpoint.`);
  await channel.close();
  await connection.close();
}



async function registerLead(connection, data) {
  try {
    const [results] = await connection.execute(
      "INSERT INTO srv_lead (fullname, email, phone, utm_source, utm_medium, utm_campaign, refer) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [data.fullname, data.email, data.phone, data.utm_source, data.utm_medium, data.utm_campaign, data.refer]
    );
    console.warn(`New lead with ID ${results.insertId} is added to the database.`);
    return results.insertId;
  } catch (error) {
    throw error;
  }
}

async function connectQueue() {
  try {
    const connection = await amqp.connect((process.env.ENV == "prod") ? process.env.AMQP_URL : "amqp://localhost:5672");
    const channel = await connection.createChannel({ heartbeat: 5 });
    const connectiondb = await connectToDb();
    await channel.assertQueue("database-queue");
    console.warn("Connected to the message queue.");

    channel.consume("database-queue", async (data) => {
      try {
        const message = JSON.parse(data.content.toString());
        await registerLead(connectiondb, message);
        await sendEndpoint(message);
        channel.ack(data);
      } catch (error) {
        console.error(error);
        channel.nack(data);
      }
    });
  } catch (error) {
    console.error(error);
  }
}

connectQueue();