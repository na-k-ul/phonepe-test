// importing modules
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");
const sha256 = require("sha256");
const uniqid = require("uniqid");
const dotenv = require('dotenv').config();

// creating express application
const app = express();

// UAT environment
const MERCHANT_ID = process.env.MERCHANT_ID;
const PHONE_PE_HOST_URL = "https://api.phonepe.com/apis/hermes";
const SALT_INDEX = 1;
const SALT_KEY = process.env.SALT_KEY;
const APP_BE_URL = "https://localhost:3010"; // our application

// setting up middleware
app.use(cors());
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: false,
  })
);

// Defining a test route
app.get("/", (req, res) => {
  res.send("PhonePe Integration APIs!");
});

// endpoint to initiate a payment
app.get("/pay", async function (req, res, next) {
  // Initiate a payment

  // Transaction amount
  const amount = 100;

  // User ID is the ID of the user present in our application DB
  let userId = "MUID123";

  // Generate a unique merchant transaction ID for each transaction
  const merchantTransactionId = `txn_${Date.now()}`;


  // redirect url => phonePe will redirect the user to this url once payment is completed. It will be a GET request, since redirectMode is "REDIRECT"
  let normalPayLoad = {
    merchantId: MERCHANT_ID, //* PHONEPE_MERCHANT_ID . Unique for each account (private)
    merchantTransactionId: merchantTransactionId,
    merchantUserId: userId,
    amount: amount * 100, // converting to paise
    redirectUrl: `www.zeroxweb.shop/payment/validate/${merchantTransactionId}`,
    redirectMode: "REDIRECT",
    mobileNumber: '9482191177',
    paymentInstrument: {
      type: "PAY_PAGE",
    },
  };

  // make base64 encoded payload
  let bufferObj = Buffer.from(JSON.stringify(normalPayLoad), "utf8");
  let base64EncodedPayload = bufferObj.toString("base64");

  // X-VERIFY => SHA256(base64EncodedPayload + "/pg/v1/pay" + SALT_KEY) + ### + SALT_INDEX
  let string = base64EncodedPayload + "/pg/v1/pay" + SALT_KEY;
  let sha256_val = sha256(string);
  let xVerifyChecksum = sha256_val + "###" + SALT_INDEX;

  axios
    .post(
      `${PHONE_PE_HOST_URL}/pg/v1/pay`,
      {
        request: base64EncodedPayload,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerifyChecksum,
          accept: "application/json",
        },
      }
    )
    .then(function (response) {
      console.log("response->", JSON.stringify(response.data));
      res.redirect(response.data.data.instrumentResponse.redirectInfo.url);
    })
    .catch(function (error) {
      res.send(error);
    });
});

// endpoint to check the status of payment
app.get("/payment/validate/:merchantTransactionId", async function (req, res) {
  const { merchantTransactionId } = req.params;
  // check the status of the payment using merchantTransactionId
  if (merchantTransactionId) {
    let statusUrl =
      `${PHONE_PE_HOST_URL}/pg/v1/status/${MERCHANT_ID}/` +
      merchantTransactionId;

    // generate X-VERIFY
    let string =
      `/pg/v1/status/${MERCHANT_ID}/` + merchantTransactionId + SALT_KEY;
    let sha256_val = sha256(string);
    let xVerifyChecksum = sha256_val + "###" + SALT_INDEX;

    axios
      .get(statusUrl, {
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerifyChecksum,
          "X-MERCHANT-ID": merchantTransactionId,
          accept: "application/json",
        },
      })
      .then(function (response) {
        console.log("response->", response.data);
        if (response.data && response.data.code === "PAYMENT_SUCCESS") {
          // redirect to FE payment success status page
          res.send(response.data);
        } else {
          // redirect to FE payment failure / pending status page
        }
      })
      .catch(function (error) {
        // redirect to FE payment failure / pending status page
        res.send(error);
      });
  } else {
    res.send("Sorry!! Error");
  }
});

// Starting the server
const port = process.env.PORT || 3010;
app.listen(port, () => {
  console.log(`PhonePe application listening on port ${port}`);
});