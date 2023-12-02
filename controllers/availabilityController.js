require('dotenv').config()

const { formattedDateNow } = require('../parsers/getTimestamp')
const Availability = require('../models/availability')

const availabilityWrapper = async (req, res) => {
    const heartbeat = {
        "agentID": req.body.agentID,
        "contact": req.body.contact,
        "contact_email": req.body.contact_email,
        "restart": req.body.restart,
        "jenkins": req.body.jenkins,
        "createdOn": req.body.createdOn,
        // "allNodes": req.body.allNodes,
        // "liveNodes": req.body.liveNodes,
        // "deadNodes": req.body.deadNodes,
        "appStatus": req.body.appStatus
    }

    let response = await createAvailability(heartbeat)

    try {
        res.status(200).json(response);
    } catch (error) {
        res.status(500).json({
            message: `Something went wrong with the availability: ${error.message}`,
            timestamp: formattedDateNow() 
        });
    }
}

function createAvailability(heartbeat) {
    return new Promise(resolve => {
        try {
            let availability = heartbeat.appStatus.map((app) => {
                return new Availability({
                    name: app.name,
                    message: app.message,
                    uptime: app.uptime,
                    timestamp: app.timestamp,
                });
            });

            resolve(
                updateDb(availability)
            )
        } catch (err) {
            resolve(
                throwErr(err)
            )
        }
    })
}


async function updateDb(availability) {
    const result = await Availability.insertMany(availability);

    console.log(`Availablity: ${result.length} documents were inserted into Availability collection`);
    
    return {
        message: `Availability: ${result.length} documents were inserted into Availability collection`,
        timestamp: formattedDateNow(),
    };
}

function throwErr(err) {
    return { message: err.message };
}

module.exports = {
    createAvailability,
    availabilityWrapper
};