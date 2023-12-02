const router = require('express').Router();
const { healthcheck } = require('../controllers/healthcheckController.js')
const { publisher } = require('../controllers/publisherController.js')
const { restartWrapper } = require('../controllers/restartController.js')
const { devopsWrapper } = require('../controllers/devopsController.js')
const { dashboardWrapper } = require('../controllers/dashboardController.js')
const { availabilityWrapper } = require('../controllers/availabilityController.js')



/** HTTP Reqeust */
router.get('/healthcheck', healthcheck)
router.post('/publisher', publisher)
router.post('/restart', restartWrapper)
router.post('/devops', devopsWrapper)
router.post('/dashboard', dashboardWrapper)
router.post('/availability', availabilityWrapper)



module.exports = router