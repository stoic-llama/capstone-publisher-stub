require('dotenv').config()

const express = require('express');
const app = express();

/****************************************************** 
 * API Content
 * Put server express routes at the beginning 
 * ****************************************************/ 
app.use(express.json());

const apiVersion = '/api/v' + process.env.API_VERSION

const router = require('./routes/route'); 
app.use(apiVersion, router);


/****************************************************** 
 * Kick off server
 * ****************************************************/ 
let port = process.env.PORT || 9999

app.listen(port, () => {
    console.log(`Server is live and running on ${port}.`);
});