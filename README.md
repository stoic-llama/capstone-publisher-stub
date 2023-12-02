# Capstone Monitoring Project - Local Agent [![License: MIT](https://img.shields.io/badge/License-MIT-brightgreen.svg)](https://opensource.org/licenses/MIT) 

![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E) ![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB) ![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white) ![Jenkins](https://img.shields.io/badge/jenkins-%232C5263.svg?style=for-the-badge&logo=jenkins&logoColor=white)

<!-- <small>*This project is part of the Central Connecticut State University capstone requirement for graduation from the Software Engineering graduate program.*</small> -->

### A Light-weight Monitoring Solution


This can be the first step to automating your workflow to build applications. See the following features below. 

- ✅ Automated restart when your web application is down
- ✅ Automated notification when your web application is down
- ✅ Dashboard to see: 
    - 💪 Current status of the availability of all apps on one page 
    - 💪 Foundational DevOps metrics measuring speed and stability of your deployment to production. 

This solution will work with any application as long as your application is hosted in a docker container.

## Prerequisites

1. A few applications that are dockerized on a host machine, and on the same docker network.

## Installation

1. 

### TODO
1. Metrics Database
    1. Availability
    2. Devops
        - Make sure the timestamp is not overwritten with each heartbeat. This is a finagling with mongodb insert statement with BulkOps. The check is against the database (1) delete one entry and see if it is repopulated on next heartbeat, and (2) change the timestamp of one entry and see if it is overwritten to today's timestamp.
    3. Dashboard
        - Make sure that the availability status is not undefined, but the latest. The check involves making sure projectAvailability[0] is copied to latestItem, not projectAvailability[0].message mistake. The mistake copied part of the object so other fields returned empty. 
