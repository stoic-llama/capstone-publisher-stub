// healthcheck for overall application - is the app up or not?
// this is not api-specfic, but overall app
// https://blog.logrocket.com/how-to-implement-a-health-check-in-node-js/

const { formattedDateNow } = require('../parsers/getTimestamp')

const publisher = (req, res) => {
    console.log(req.body)
    try {
        res.status(200).json({
            message: "Message received!",
            timestamp: formattedDateNow() 
        });
    } catch (error) {
        console.log(error)

        res.status(500).json({
            message: error.message,
            timestamp: formattedDateNow() 
        });
    }
};

module.exports = {
    publisher
};