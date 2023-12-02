const axios = require('axios');
const { formattedDateNow } = require('../parsers/getTimestamp')
const Down = require('../models/down')


const restartWrapper = async (req, res) => {
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

    let response = await restart(heartbeat)

    try {
        res.status(200).json(response);
    } catch (error) {
        res.status(500).json({
            message: `Something went wrong with the restart: ${error.message}`,
            timestamp: formattedDateNow() 
        });
    }
}


function restart(heartbeat) {
    return new Promise( (resolve) => {
        /*
        1. Find all the apps from database "metrics" collection "down" based on heartbeat object
        a. If app.name in heartbeat not in collection "down"
            i) insert app into down collection as a new app object:
                app.name = heartbeat.appStatus.name, 
                app.message = heartbeat.appStatus.message, 
                app.timestamp = heartbeat.appStatus.timestamp, 
                app.counter = app.message === 'OK' ? 0 : 1,
                app.restartStatus = null,
                app.restartTimestamp = null
            b. If app.name in heartbeat already in collection "down"
                i. update only app.counter = app.message === 'OK' ? 0 : app.counter + 1
                    A) if an app object has an app.counter > 1:
                        1) Invoke restart GET API with a parameter of name = app.name 
                        and wait for response. When response is returned, update the app object:
                        app.restartStatus = response.restartStatus,
                        app.restartTimestamp = response.timestamp  
                        2) Invoke email POST API with a req.body:
                        req.body.userName = heartbeat.contact, 
                        req.body.userEmail = heartbeat.contact_email, 
                        req.body.apps = heartbeat.appStatus
        */
        getDownEntries()
        .then( async (down) => {
            let apps = [] // from heartbeat
            let restartCounter = 0 // return at end of this function

            // Find all apps in scope
            heartbeat.appStatus.map((app) => {
                apps.push({
                name: app.name, 
                message: app.message, 
                timestamp: app.timestamp, 
                })
            })

            // compare heartbeat vs Down collection   
            for (const app of apps) {
                // Find one element from database that is same name as heartbeat
                const existingApp = down.find((d) => d.name === app.name);
            
                if (existingApp) { // element found
                    // If heartbeat.message is OK, then 0
                    // If heartbeat.message is not OK, then increment the counter from db by 1
                    let counter = app.message === 'OK' ? 0 : existingApp.counter + 1

                    if (counter > 1) {
                        let response = await localRestart(app.name, heartbeat.restart)             

                        await Down.updateOne(
                            { name: app.name },
                            {
                                $set: {
                                    counter: counter,
                                    restartStatus: response.restartStatus,
                                    restartTimestamp: response.timestamp
                                },
                            }
                        )

                        await restartEmail(
                            {
                                name: app.name,
                                message: app.message,
                                counter: counter,
                                timestamp: app.timestamp,
                                restartStatus: response.restartStatus,
                                restartTimestamp: response.timestamp                 
                            }, 
                            heartbeat
                        )

                        // increment attempts to restart, regardless result
                        restartCounter += restartCounter
                    } else { // counter is 0 or 1
                        await Down.updateOne(
                            { name: app.name },
                            {
                                $set: {
                                    counter: counter,
                                    restartStatus: null,
                                    restartTimestamp: null
                                },
                            }
                        );
                    }
                } else { // element not found
                    await Down.create(
                        { 
                            name: app.name,
                            message: app.message,
                            counter: app.message === 'OK' ? 0 : 1,
                            timestamp: app.timestamp,
                            restartStatus: null,
                            restartTimestamp: null,
                        }
                    )
                    .then((result) => {
                        console.log("New Down entry inserted successful")
                        console.log(result)
                    })
                    .catch((err) => {
                        console.log("New Down entry could not be inserted")
                        console.log(err)                    
                    })
                }
            }
            return restartCounter
        })
        .then( (restartCounter) => {
            resolve(
                restartResponse(restartCounter)
            )
        }) 
    })
}

function restartResponse(restartCounter) {
    return {
        message: `Restart: ${restartCounter} attempt(s) with this heartbeat.`,
        timestamp: formattedDateNow()
    }
}

function getDownEntries() {
    return new Promise( async (resolve) => {
        resolve(
            await Down.find({})
            .exec()
            .then((entries) => {
                return entries
            })
            .catch((err) => {
                console.error(err);
            })
        )
    })
}

function localRestart(name, url) { // POST to local-agent restart API
    return axios
        .post(
            url,
            {
                name: name
            }, 
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        )
        .then((response) => {
            return response.data 
        })
        .catch((error) => {
            console.log("Something is wrong with the restart API response")
            console.log(error);   
        });
}

function restartEmail(app, heartbeat) {
    let data = JSON.stringify({
      "userEmail": heartbeat.contact_email,
      "userName": heartbeat.contact,
      "apps": [
        {
          "Application": app.name,
          "Status": app.message === 'OK' ? "UP" : "DOWN",
          "Timestamp": app.timestamp,
          "RestartStatus": app.restartStatus,
          "RestartTimestamp": app.restartTimestamp
        },
      ]
    });

    let url = process.env.EMAIL_SERVICE_API

    return axios
        .post(
            url, 
            data, 
            {
                headers: { 
                    'Content-Type': 'application/json'
                },
            }
        )
        .catch((error) => {
            console.log("POST to email service failed")
            console.log(error);
        });
}

module.exports = {
    restart,
    restartWrapper
};