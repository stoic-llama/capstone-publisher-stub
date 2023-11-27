const mongoose = require('mongoose')

const availabilitySchema = new mongoose.Schema({    
    "name": {
        type: String,
        required: true,        
    },
    "message": {
        type: String,
        required: true,   
    },
    "uptime": {
        type: String,
        required: true,   
    },
    "timestamp": {
        type: String,
        required: true,   
    },
})

// .model() function allows us to directly interact with database schema
module.exports = mongoose.model('Availability', availabilitySchema, 'availability')