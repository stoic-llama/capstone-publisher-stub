require('dotenv').config()

const { formattedDateNow } = require('../parsers/getTimestamp')
const { createDevops } = require('./devopsController')
const { createAvailability } = require('./availabilityController')
const { createDashboard } = require('./dashboardController')
const { restart } = require('./restartController')


///////////////////
//   Publisher   //
///////////////////

const publisher = async (req, res) => {
    let response = {}

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

    response.devops = await createDevops(heartbeat)
    response.availability = await createAvailability(heartbeat)
    response.restart = await restart(heartbeat)
    response.dashboard = await createDashboard(heartbeat)

    await publisherResponse(response, res)
};

function publisherResponse(controllerResponses, res) {
    return new Promise(resolve => {
        try {
            console.log("controllerResponses in publisherController")
            console.log(controllerResponses)
            resolve(res.status(200).json(controllerResponses))
        } catch (error) {
            resolve(
                res.status(500).json({
                    message: `Something went wrong with the publisher API: ${error.message}`,
                    timestamp: formattedDateNow() 
                })
            )
        }
    })
}


module.exports = {
    publisher
};