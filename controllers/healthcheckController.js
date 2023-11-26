// healthcheck for overall application - is the app up or not?
// this is not api-specfic, but overall app
// https://blog.logrocket.com/how-to-implement-a-health-check-in-node-js/

const { formattedDateNow } = require('../parsers/getTimestamp')

const healthcheck = (req, res) => {
    const heartbeat = {
        name: 'capstone-publisher-stub',
        message: 'UP',
        uptime: Math.floor(process.uptime()) + " seconds",
        timestamp: formattedDateNow()  
    };
    try {
        res.status(200).json(heartbeat);
    } catch (error) {
        res.status(500).json({
            name: 'capstone-publisher-stub',
            message: error.message,
            uptime: Math.floor(process.uptime()) + " seconds",
            timestamp: formattedDateNow() 
        });
    }
};

module.exports = {
    healthcheck
};