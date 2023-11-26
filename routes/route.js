const router = require('express').Router();
const { healthcheck } = require('../controllers/healthcheckController.js')
const { publisher } = require('../controllers/publisherController.js')

/** HTTP Reqeust */
router.get('/healthcheck', healthcheck)
router.post('/publisher', publisher)

module.exports = router