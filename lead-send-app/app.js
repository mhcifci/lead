const dotenv = require("dotenv");
dotenv.config();
const amqp = require("amqplib");
const axios = require("axios");
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: (process.env.DB_HOST === "prod") ? process.env.DB_HOST : "localhost",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});


console.warn("Endpoint sending service is started");

let veriCount = 0;
let totalCustomers = 0;

const brokerCustomers = {}; // Broker müşteri sayılarını tutacak obje

async function postData(data) {
  await new Promise((resolve) => {
    setTimeout(resolve, 2000);
  });
  const response = await axios.post(process.env.API_URL, data);
  return response;
}

async function connectQueue() {
  const connection = await amqp.connect((process.env.ENV == "prod") ? process.env.AMQP_URL : "amqp://localhost:5672");
  const channel = await connection.createChannel({ heartbeat: 5 });
  await channel.assertQueue("endpoint-queue");
  await channel.consume("endpoint-queue", handleMessage.bind(null, channel));
}

async function getBrokers() {
  try {
    const conn = await pool.getConnection();
    const [rows, fields] = await conn.query('SELECT broker, percent, rejected_refers FROM brokers');
    conn.release();
    const rejectedLeads = {};
    for (const { broker, rejected_refers } of rows) {
      if (rejected_refers) {
        rejectedLeads[broker] = rejected_refers.split(',');
      }
    }
    return { brokers: rows, rejectedLeads: rejectedLeads };
  } catch (err) {
    throw err;
  }
}

async function handleMessage(channel, data) {
  if (data !== null) {
    veriCount++;
    const getData = JSON.parse(Buffer.from(data.content));
    totalCustomers++;

    const {brokers, rejectedLeads} = await getBrokers();
    const firm = await selectFirm(brokers, rejectedLeads, getData.refer);
    const formData = {
      "name": getData.fullname,
      "email": getData.email,
      "phone": getData.phone,
      "phoneCode": "+90",
      "refer": getData.refer,
      "utm_source": getData.utm_source,
      "utm_campaign": getData.utm_campaign,
      "utm_medium": getData.utm_medium,
      "broker": firm.broker,
    };

    try {
      console.log(formData);
      await postData(formData);
      console.error(`${formData.phone} => ${firm.broker} firmasına gitti.`);
      channel.ack(data);

      // Seçilen firmanın müşteri sayısı artırılır
      if (brokerCustomers.hasOwnProperty(firm.broker)) {
        brokerCustomers[firm.broker]++;
      } else {
        brokerCustomers[firm.broker] = 1;
      }
    } catch (error) {
      console.log(error);
      channel.nack(data);
    }
  }
  console.log(brokerCustomers);
}

async function selectFirm(brokerList, rejectedLeads, refer) {
  let totalPercentage = 0;
  for (let i = 0; i < brokerList.length; i++) {
    totalPercentage += brokerList[i].percent;
  }

  let rand = Math.random() * totalPercentage;
  for (let i = 0; i < brokerList.length; i++) {
    if (rand <= brokerList[i].percent) {
      //return {broker: brokerList[i].broker, percentage: brokerList[i].percent};
      const broker = brokerList[i].broker;
      if (rejectedLeads[broker] && rejectedLeads[broker].includes(refer)) {
        return await selectFirm(brokerList.filter(b => b.broker !== broker), rejectedLeads);
      } else {
        return { broker: broker, percentage: brokerList[i].percent };
      }
    }
    rand -= brokerList[i].percent;
  }
}

connectQueue();
