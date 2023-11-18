const router = require('express').Router();
const { healthcheck } = require('../controller/healthcheckController.js')
const { publisher } = require('../controller/publisherController.js')

/** HTTP Reqeust */
router.get('/healthcheck', healthcheck)
router.post('/publisher', publisher)

module.exports = router