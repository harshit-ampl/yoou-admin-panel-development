require("dotenv").config();
const cron = require("node-cron");
const axios = require("axios");
const nodemailer = require("nodemailer");

const SHOP_URL = "https://www.pngjewellers.com";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendErrorEmail(errorMessage) {
  try {
    await transporter.sendMail({
      from: `"Monitor Alert" <${process.env.EMAIL_USER}>`,
      to: process.env.TO_EMAIL,
      subject: "❌ Shopify site is DOWN",
      text: `Shopify site is down!\n\nError: ${errorMessage}\n\nTime: ${new Date().toISOString()}`,
    });
    console.log("📧 Email sent on exception");
  } catch (err) {
    console.error("❌ Failed to send email:", err.message);
  }
}

cron.schedule("* * * * *", async () => {
  console.log(`[${new Date().toISOString()}] Checking Shopify site...`);

  try {
    const res = await axios.get(SHOP_URL, { timeout: 5000 });

    if (res.status >= 200 && res.status < 400) {
      console.log("✅ Shopify site is UP");
    } else {
      throw new Error(`Unexpected status code: ${res.status}`);
    }
  } catch (err) {
    console.log("❌ Shopify site is DOWN:", err.message);
    await sendErrorEmail(err.message);
  }
});
