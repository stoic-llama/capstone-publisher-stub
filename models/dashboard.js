const mongoose = require('mongoose')

const dashboardSchema = new mongoose.Schema({    
    "name": {
        type: String,
        required: true,        
    },
    "availability": {
        type: String,
        required: true,   
    },
    "timeToProd": {
        type: Number,
        required: true,   
    },
    "freqToProd": {
        type: Number,
        required: true,   
    },
    "mttr": {
        type: Number,
        required: true,   
    },
    "changeFailRate": {
        type: Number,
        required: true,   
    },
    "timestamp": {
        type: String,
        required: true,   
    },
})

// .model() function allows us to directly interact with database schema
module.exports = mongoose.model('Dashboard', dashboardSchema, 'dashboard')