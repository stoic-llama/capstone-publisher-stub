require('dotenv').config()

const axios = require('axios');
const { formattedDateNow } = require('../parsers/getTimestamp')
const Availability = require('../models/availability')
const Devops = require('../models/devops')



///////////////////
//   Publisher   //
///////////////////

const publisher = (req, res) => {
    const heartbeat = {
        "agentID": req.body.agentID,
        "contact": req.body.contact,
        "contact_email": req.body.contact_email,
        "restart": req.body.restart,
        "jenkins": req.body.jenkins,
        "createdOn": req.body.createdOn,
        "allNodes": req.body.allNodes,
        "liveNodes": req.body.liveNodes,
        "deadNodes": req.body.deadNodes,
        "appStatus": req.body.appStatus
    }

    try {
        Promise.all([
            createAvailability(heartbeat),
            createDevops(heartbeat),

        ])
        .then( values => {
            console.log("values: ")
            console.log(values)

            res.status(200).json({
                message: "Message received!",
                timestamp: formattedDateNow() 
            });
        })
    } catch (error) {
        console.log(error)

        res.status(500).json({
            message: error.message,
            timestamp: formattedDateNow() 
        });
    }
};

/****************
 * Availability *
 ****************/
const createAvailability = async (heartbeat) => {    
    let availability = []
    try {
        heartbeat.appStatus.forEach( (app) => {
            availability.push( 
                new Availability({
                    "name": app.name,
                    "message": app.message,
                    "uptime": app.uptime,
                    "timestamp": app.timestamp,
                }
            ))
        })

	    const result = await Availability.insertMany(availability);	 
        
        console.log(`${result.length} apps were inserted into Availability collection`);
        
        return {
            message: `${result.length} apps were inserted into Availability collection`,
            timestamp: formattedDateNow()
        }    
    } catch (err) {
        return {message: err.message}
    } 
}

/**********
 * Devops *
 **********/
const createDevops = function (heartbeat) {
    // Initialize variables
    let projects = [];
    let builds = [];
  
    // Step 1: Get list of names and urls from heartbeat.
    // This is a list of projects.
    heartbeat.jenkins.map((project) => {
        projects.push({
            name: project.name,
            url: project.url,
        });
    });
  
    // console.log("projects")
    // console.log(projects)

    // Step 2: Get list of all the duration, result, and number per project.
    // This is a list of builds per project.
    // Now we are flattening the data structure projects --> builds level.
    Promise.all(
        projects.map((project) => {
            let config = {
                method: 'get',
                maxBodyLength: Infinity,
                url: project.url,
                headers: {
                    Authorization: process.env.JENKINS_API_KEY,
                },
            };
  
            return axios
                .request(config)
                .then((response) => {
                    // console.log("response.data:")
                    // console.log(response.data)
                    response.data.builds.forEach((build) => {
                        builds.push({
                            name: project.name,
                            number: build.number,
                            result: build.result,
                            url: project.url,
                            duration: build.duration,
                        });
                    });
                })
                .catch((error) => {
                    console.log(error);
                }
            );
        })
    )
    .then(() => {
        // Step 3: Perform updateMany by project
        const bulkOps = builds.map((build) => ({
            updateOne: {
                filter: { name: build.name, number: build.number },
                update: {
                    $set: {
                        name: build.name,
                        number: build.number,
                        result: build.result,
                        url: build.url,
                        duration: build.duration,
                        timestamp: formattedDateNow()
                    },
                    $addToSet: {
                        builds: {
                            name: build.name,
                            number: build.number,
                            result: build.result,
                            url: build.url,
                            duration: build.duration,
                            timestamp: formattedDateNow()
                        },
                    },
                },
                upsert: true, // Create a new document if not found
            },
        }));
        return Devops.bulkWrite(bulkOps);
    })
    .then((result) => {
        console.log(`${result.upsertedCount} documents inserted, ${result.modifiedCount} documents updated`);

        return {
            message: `${result.upsertedCount} documents inserted, ${result.modifiedCount} documents updated`,
            timestamp: formattedDateNow()
        }
    })
    .catch((error) => {
        console.error('Error updating/inserting documents:', error);

        return {
            message: `Error updating/inserting documents:' ${error}`,
            timestamp: formattedDateNow()
        }
    });
};


module.exports = {
    publisher
};