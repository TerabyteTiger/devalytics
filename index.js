require("dotenv").config();

const axios = require("axios");

//DEV Connection API
const config = {
  headers: {
    "api-key": process.env.DEV_API_KEY,
  },
};

//Firestore 🔥
const firebase = require("firebase/app");
require("firebase/firestore");

// Service Account
const admin = require("firebase-admin");

const serviceAccount = {
  type: process.env.SA_type,
  project_id: process.env.SA_project_id,
  private_key_id: process.env.SA_private_key_id,
  private_key: process.env.SA_private_key.replace(/\\n/g, "\n"),
  client_email: process.env.SA_client_email,
  client_id: process.env.SA_client_id,
  auth_uri: process.env.SA_auth_uri,
  token_uri: process.env.SA_token_uri,
  auth_provider_x509_cert_url: process.env.SA_auth_provider_x509_cert_url,
  client_x509_cert_url: process.env.SA_client_x509_cert_url,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://dev-to-daily-stats.firebaseio.com",
});

let db = admin.firestore();

const firebaseConfig = {
  apiKey: process.env.FIREBASE_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DB_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

firebase.initializeApp(firebaseConfig);

// utils
// const db = firebase.firestore();

// collections
const devCollection = db.collection("dev");

// Calc date for setting in update dates array on records
const now = new Date().toLocaleDateString();

// Loop over Array of articles
function processData() {
  axios
    .get("https://dev.to/api/articles/me/published", config)
    .then(async function (response) {
      // handle success 👍
      // console.log(response.data[0]);
      let i;
      for (i = 0; i < response.data.length; i++) {
        let article = response.data[i];
        const articleRef = devCollection.doc("" + article.id);
        const doc = await articleRef.get();
        if (!doc.exists) {
          // Process a new document here
          const data = {
            title: article.title,
            url: article.url,
            dates: [now],
            viewsDaily: [article.page_views_count],
            viewsTotal: [article.page_views_count],
            commentsDaily: [article.comments_count],
            commentsTotal: [article.comments_count],
            reactionsDaily: [article.public_reactions_count],
            reactionsTotal: [article.public_reactions_count],
          };

          const res = await devCollection.doc("" + article.id).set(data);
        } else {
          // Update existing document
          let data = {
            ...doc.data(),
          };

          // Add today's data
          // Views 👀
          data.viewsTotal.push(article.page_views_count);
          data.viewsDaily.push(
            data.viewsTotal[data.viewsTotal.length - 1] -
              data.viewsTotal[data.viewsTotal.length - 2]
          );

          // Comments 💬
          data.commentsTotal.push(article.comments_count);
          data.commentsDaily.push(
            data.commentsTotal[data.commentsTotal.length - 1] -
              data.commentsTotal[data.commentsTotal.length - 2]
          );

          // Reactions 🦄
          data.reactionsTotal.push(article.public_reactions_count);
          data.reactionsDaily.push(
            data.reactionsTotal[data.reactionsTotal.length - 1] -
              data.reactionsTotal[data.reactionsTotal.length - 2]
          );

          // Add date
          data.dates.push(now);

          const res = await devCollection
            .doc("" + article.id)
            .set(data, { merge: true });
        }
      }
    })
    .then(async function (response) {
      console.log("Setting Meta");
      // Set a "meta" document catch-all
      devCollection.doc("meta").set(
        {
          updatedOn: now,
        },
        { merge: true }
      );
    })
    .finally(() => {
      console.log("async finished");
    })
    .catch(function (error) {
      // handle error 👎
      console.log(error);
    });
}

async function checkDailyRun() {
  // @ Return 'true' if processData() should run
  const metaDoc = await devCollection.doc("meta").get();

  if (!metaDoc.exists) {
    return true;
  } else {
    console.log(metaDoc.data());
    if (metaDoc.data().updatedOn == now) {
      return false;
    } else {
      return true;
    }
  }
}

// Call Fuctions
checkDailyRun().then((result) => {
  console.log(result);
  if (result) {
    processData();
  }
});
