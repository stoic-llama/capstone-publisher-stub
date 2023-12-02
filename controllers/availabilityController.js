require('dotenv').config()

const { formattedDateNow } = require('../parsers/getTimestamp')
const Availability = require('../models/availability')

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
    createAvailability
};