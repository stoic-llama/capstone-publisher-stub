require('dotenv').config()

const axios = require('axios');
const { formattedDateNow } = require('../parsers/getTimestamp')
const Availability = require('../models/availability')
const Devops = require('../models/devops')
const Dashboard = require('../models/dashboard')



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
        .then( () => {
            // need the latest heartbeat data inserted into database
            // createDashboard calculates metrics based on what is in database
            createDashboard(heartbeat)
        })
        .then( () => {
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
    try {
        let availability = heartbeat.appStatus.map((app) => {
            return new Availability({
                    name: app.name,
                    message: app.message,
                    uptime: app.uptime,
                    timestamp: app.timestamp,
                });
            });

            const result = await Availability.insertMany(availability);

            console.log(`Availablity: ${result.length} documents were inserted into Availability collection`);

            return {
                message: `Availability: ${result.length} documents were inserted into Availability collection`,
                timestamp: formattedDateNow(),
            };
    } catch (err) {
        return { message: err.message };
    }
};
  

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
                    //     // timestamp: formattedDateNow()
                    // },
                    $addToSet: { // Adds elements to an array ONLY if element not already exist in the set. 
                        builds: {
                            name: build.name,
                            number: build.number,
                            result: build.result,
                            url: build.url,
                            duration: build.duration,
                            timestamp: formattedDateNow()
                        },
                    },
                    /*  
                        In this modification, the $setOnInsert operator ensures that the timestamp
                        field is only set when a new document is created (i.e., during the 
                        upsert operation) and obviously when the timestamp field exists. 

                        If the document is already created, the $setOnInsert part won't be executed. 
                        As a result, the existing timestamp value won't be modified as well.
                    */
                    // $setOnInsert: {
                    //     timestamp: { $exists: false } 
                    // },
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
    });
};


/*************
 * Dashboard *
 *************/
/*
    Availability
    Step 1: Take the heartbeat appStatus.message for current availability
        If 'OK' -> 'UP' 
        Else -> 'DOWN

    Time to Prod
    Step 2: Take a list of projects by name $and by number
    Step 3: Sum the duration and divide by the count of builds. Only count successful builds. -- within one project. Repeat for each project.
    
    Freq to Prod
    Step 4: Take same list of projects by name $and by number
    Step 5: Have a count of builds per project. Only count the ones are successful.

    MTTR
    Step 6: Take same list of projects by name $and by number
    Step 7: Create a sublist from the prior list. When hit one FAILURE, 
            then pair it with following one that is SUCESS. 
            Continue until hit the end of the prior list.
    Step 8: For each pair of FAILURE to SUCCESS, minus the two timestamps for outage period.
    Step 9: Average the list of outage periods.

    Change Fail Rate
    Step 10: Take same list of projects by name $and by number
    Step 11: Have a count of FAILURE
    Step 12: Divide the count of FAILURE with the total number of builds

*/
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
    publisher
};