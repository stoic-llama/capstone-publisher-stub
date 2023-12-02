require('dotenv').config()

const { formattedDateNow } = require('../parsers/getTimestamp')
const Availability = require('../models/availability')
const Devops = require('../models/devops')
const Dashboard = require('../models/dashboard')

const dashboardWrapper = async (req, res) => {
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

    let response = await createDashboard(heartbeat)

    try {
        res.status(200).json(response);
    } catch (error) {
        res.status(500).json({
            message: `Something went wrong with the dashboard: ${error.message}`,
            timestamp: formattedDateNow() 
        });
    }
}


const createDashboard = async (heartbeat) => {
    // Step 1 - Initialize variables
    let projects = [];
    let availability = [] // from Availability collection
    let builds = [] // from Devops collection
    let summary = []
    let today = new Date()
    let month = today.getMonth() + 1    // 10 (Month is 0-based, so 10 means 11th Month)
    let year = today.getFullYear()   // 2020
    let currentDate = `${year}-${month}`

    // This is a list of projects/apps.
    heartbeat.jenkins.map((project) => {
        projects.push({
            name: project.name,
            url: project.url,
        });
    });

    // Find all availability collection entries for MTTR calculation later
    await Availability.find({})
    .exec()
    .then((entries) => {
        availability = entries.map((item) => {
            // let status = item.message === 'OK' ? 'UP' : 'DOWN'
            // console.log(item.name + ": " + status + "| Original: " + item.message)
            return {
                name: item.name,
                message: item.message === 'OK' ? 'UP' : 'DOWN',
                timestamp: item.timestamp,
            };
        });
    })
    .catch((err) => {
        console.error(err);
    })

    await Devops.find({})
    .exec()
    .then((entries) => {
        builds = entries;
    })
    .catch((err) => {
        console.error(err);
    })

    /* *************** */

    // Step 2 - Availability Metric
    projects.forEach( project => {
        let projectAvailability = availability.filter(availability => project.name === availability.name)

        // Initialize the latestItem with the first element
        let latestItem = projectAvailability[0];

        // Find the item with the latest timestamp
        for (let i = 1; i < projectAvailability.length; i++) {
            const currentTimestamp = new Date(projectAvailability[i].timestamp);
            const latestTimestamp = new Date(latestItem.timestamp);

            if (currentTimestamp > latestTimestamp) {
                latestItem = projectAvailability[i];
            }
        }
        project.availability = latestItem.message
    })

    summary = projects.map(project => {
        return {
            name: project.name,
            availability: project.availability,
            builds: builds.filter(build => build.name === project.name),
        };
    });

    // Step 3 - timeToProd Metric
    summary.forEach(item => {        
        let currentMonthBuilds = item.builds.filter(build => build.timestamp.startsWith(currentDate));
        
        let sumDuration = 0
        for (const build of currentMonthBuilds) {
            sumDuration += build.duration
        } 

        let averageDuration = currentMonthBuilds.length > 0 ? sumDuration / currentMonthBuilds.length : 0
        item.timeToProd = Math.ceil(averageDuration / (1000)) // convert milliseconds to seconds
    });

    // Step 4 - freqToProd Metric
    summary.forEach(item => {
        let currentMonthBuilds = item.builds.filter(build => build.timestamp.startsWith(currentDate));
        let successBuilds = currentMonthBuilds.filter(build => build.result === 'SUCCESS')
        item.freqToProd = successBuilds.length
    });

    // Step 5 - Mean Time To Resolution (mttr) Metric 
    // Note: Uses availability raw data.
    summary.forEach(summaryItem => {
        let mttrArr = getMTTR(availability)
        mttrArr.forEach( mttrArrItem => {
                if(mttrArrItem.name === summaryItem.name) {
                    summaryItem.mttr = mttrArrItem.mean
                } else {
                    summaryItem.mttr = 0 // no outage, so 0 time to restore
                }
            }) 
        }
    )

    // Step 6 - changeFailRate Metric 
    summary.forEach(item => {
        let currentMonthBuilds = item.builds.filter(build => build.timestamp.startsWith(currentDate));
        let totalBuilds = currentMonthBuilds.length
        let failureBuilds = currentMonthBuilds.filter(build => build.result === 'FAILURE').length
        item.changeFailRate = totalBuilds > 0 ? Math.ceil((failureBuilds / totalBuilds) * 100) : 0 // round up
    })

    // Step 7 - add timestamp to all items in summary
    summary.forEach(item => item.timestamp = formattedDateNow())

    // Step 8 - insertMany into MongoDb database Metrics collection Dashboard
    try {
        console.log("trying insertMany now...")

        const result = await Dashboard.insertMany(summary);	 
        console.log("result")
        console.log(result)

        console.log(`Dashboard: ${result.length} documents were inserted into Dashboard collection`);
        
        return {
            message: `Dashboard: ${result.length} documents were inserted into Dashboard collection`,
            timestamp: formattedDateNow()
        }    
    } catch (err) {
        console.log("there was an error with insertMany: ")
        console.log(err)
        return {message: err.message}
    }
}


/*
getMTTR() logic:
Step 1 - Create an array "averages" of objects.  
            Each object will have fields: name, outageDuration.
Step 2 - Create an array "temp" of objects.  
            Each object will have fields: name, failureTimestamp, restorationTimestamp.
Step 3 - Traverse through the array "availability".  
            When an item with message === 'DOWN' is found, create a new object in array "temp", 
            and save the timestamp value to the failureTimestamp field of the newly created object.  Also save the name of the item from the availability array to the name field in the newly created object.  Keep tab of this object in the array "temp" for Step 4.  
Step 4 - Continue traversing the array availability.  
            When the first item with message === 'UP' is found, 
            save the timestamp value to the restorationTimestamp field of the object from step 2.  
Step 5 - For the object from steps 3 and 4, subtract the restorationTimestamp from the failureTimestamp to an variable difference, 
            and create a new object in the array "averages" and save the value duration to the field outageDuration.  Also save the name of the object from the item from the "temp" array to the new object in the "averages" array.
Step 6 - Repeat steps 3 through 5 until you reach the end of the array availability.
Step 7 - Create a new array "mttr" of objects with fields: outages, mean.  
Step 8 - Group the items from the array "averages" by the name field 
            and save as an array into the field "outages" for each item in the array "mttr".  
Step 9 - Then in each item of the array "mttr", 
            loop through the array in the field "outages" 
            and add the duration field value, 
            and divide by the count of the items in the array in the field "outages".  Save the result into the field "mean" for each object in the array "mttr".
*/
function getMTTR(availability) {
    // Step 1-2, 6 - initialize variables
    let outagesDurationArr = [];
    let mttr = [];

    // Steps 3-6
    let currentIndex = 0;
    while (currentIndex < availability.length) {
        // Find the first DOWN message
        while (currentIndex < availability.length && availability[currentIndex].message !== 'DOWN') {
            currentIndex++;
        }

        // If DOWN message found
        if (currentIndex < availability.length) {
            let outageObject = {
                name: availability[currentIndex].name,
                failureTimestamp: availability[currentIndex].timestamp,
            };
            currentIndex++;

            // Step 4 - Continue traversing the array availability.  
            // When the first item with message === 'UP' is found, 
            // save the timestamp value to the restorationTimestamp field of the object from step 2.  
            while (currentIndex < availability.length && availability[currentIndex].message !== 'UP') {
                currentIndex++;
            }

            // Step 5
            if (currentIndex < availability.length) {
                outageObject.restorationTimestamp = availability[currentIndex].timestamp;
                let difference = new Date(outageObject.restorationTimestamp).getTime() - new Date(outageObject.failureTimestamp).getTime();

                // Step 6
                outagesDurationArr.push({
                    name: outageObject.name,
                    outageDuration: Math.ceil((difference / (1000 * 60))), // Convert milliseconds to seconds to min, and round up min
                });
            }
        }
    }

    // Step 8-9
    let nameSet = new Set();
    outagesDurationArr.forEach(outage => {
        if (!nameSet.has(outage.name)) {
            let sum = 0;
            let count = 0;

            // Loop through the array to calculate the sum and count for the current name
            for (let i = 0; i < outagesDurationArr.length; i++) {
                if (outagesDurationArr[i].name === outage.name) {
                    sum += outagesDurationArr[i].outageDuration;
                    count++;
                }
            }

            let avg = sum / count;

            // Step 3
            mttr.push({
                name: outage.name,
                mean: avg, // in minutes
            });

            // Mark the name as processed
            nameSet.add(outage.name);
        }
    });

    return mttr
}

module.exports = {
    createDashboard,
    dashboardWrapper
};