require('dotenv').config()

const axios = require('axios');
const { formattedDateNow } = require('../parsers/getTimestamp')
const Devops = require('../models/devops')


const devopsWrapper = async (req, res) => {
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

    let response = await createDevops(heartbeat)

    try {
        res.status(200).json(response);
    } catch (error) {
        res.status(500).json({
            message: `Something went wrong with the devops: ${error.message}`,
            timestamp: formattedDateNow() 
        });
    }
}


function createDevops(heartbeat) {
    return new Promise(resolve => {
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
    
        resolve(
            // Step 2: Get list of all the duration, result, and number per project.
            // This is a list of builds per project.
            // Now we are flattening the data structure projects --> builds level.
            Promise.all(
                projects.map((project) => {
                    return axios
                        .get(project.url, {
                            headers: {
                                'Authorization': `Basic ${process.env.JENKINS_API_KEY}`,
                            }
                        })
                        .then((response) => {
                            response.data.builds.forEach((build) => {
                                builds.push({
                                    name: project.name,
                                    number: build.number,
                                    result: build.result,
                                    url: project.url,
                                    duration: build.duration,
                                    timestamp: build.timestamp
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
                            // $set: { // Sets the value of a field in a document. 
                            //     name: build.name,
                            //     number: build.number,
                            //     result: build.result,
                            //     url: build.url,
                            //     duration: build.duration,
                            // },
                            // $addToSet: { // Adds elements to an array ONLY if element not already exist in the set. 
                            //     builds: {
                            //         name: build.name,
                            //         number: build.number,
                            //         result: build.result,
                            //         url: build.url,
                            //         duration: build.duration,
                            //         timestamp: formattedDateNow()
                            //     },
                            // },
                            /*  
                                In this modification, the $setOnInsert operator ensures that the timestamp
                                field is only set when a new document is created. 
                                If the document is already created, the $setOnInsert part won't be executed. 
                            */
                            $setOnInsert: {
                                name: build.name,
                                number: build.number,
                                result: build.result,
                                url: build.url,
                                duration: build.duration,
                                timestamp: formattedDateNow()
                            },
                        },
                        upsert: true, // Create a new document if not found
                    },
                }));
                return Devops.bulkWrite(bulkOps);
            })
            .then((result) => {
                console.log(`Devops: ${result.upsertedCount} documents inserted, ${result.modifiedCount} documents updated`);
        
                return {
                    message: `Devops: ${result.upsertedCount} documents inserted, ${result.modifiedCount} documents updated`,
                    timestamp: formattedDateNow()
                }
            })
            .catch((error) => {
                console.error('Error updating/inserting documents:', error);
    
                return {
                    message: `Error updating/inserting documents:' ${error}`,
                    timestamp: formattedDateNow()
                }
            })
        )
    })
};

module.exports = {
    createDevops,
    devopsWrapper
};