const mongoose = require('mongoose')

/* 
app.name = heartbeat.appStatus.name, 
app.message = heartbeat.appStatus.message, 
app.timestamp = heartbeat.appStatus.timestamp, 
app.counter = app.message === 'OK' : 0 ? 1,
app.restartStatus = null,
app.restartTimestamp = null
*/

const downSchema = new mongoose.Schema({    
    "name": {
        type: String,
        required: true,        
    },
    "message": {
        type: String,
        required: true,   
    },
    "counter": {
        type: Number,
        required: true,   
    },
    "restartStatus": {
        type: String,
        required: false,   
    },
    "restartTimestamp": {
        type: String,
        required: false,   
    },
    "timestamp": {
        type: String,
        required: true,   
    },
})

// .model() function allows us to directly interact with database schema
module.exports = mongoose.model('Down', downSchema, 'down')