require('dotenv').config()

const express = require('express');
const app = express();
const mongoose = require('mongoose')

//////////////////
//   Database   //
//////////////////

// setup database connection
mongoose.connect(process.env.DATABASE_URL, { useNewUrlParser: true})
const db = mongoose.connection 
db.on('error', (error) => console.error(error))
db.once('open', () => console.log('Connected to database'))


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