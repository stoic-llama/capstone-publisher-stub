const mongoose = require('mongoose')

const devopsSchema = new mongoose.Schema({    
    "name": {
        type: String,
        required: true,        
    },
    "number": {
        type: Number,
        required: true,   
    },
    "result": {
        type: String,
        required: true,   
    },
    "url": {
        type: String,
        required: true,   
    },
    "duration": {
        type: Date,
        required: true,   
    },
    "timestamp": {
        type: Date,
        required: true,   
    },
})

// .model() function allows us to directly interact with database schema
module.exports = mongoose.model('Devops', devopsSchema, 'devops')