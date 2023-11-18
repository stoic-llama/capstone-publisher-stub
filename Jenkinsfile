pipeline {
    agent any
    environment {
        version = '1.0'
        containerName = 'capstone-publisher-stub'
    }

    stages {
        stage("login") {
            steps {
                echo 'authenticating into jenkins server...'
                sh 'docker login'
                // sh 'docker login registry.digitalocean.com'
                
                // note you need to manually add token for capstone-ccsu once 
                // in Jenkins conatiner that is in the droplet
                // Refer to "API" tab in Digital Ocean
                // sh 'doctl auth init --context capstone-ccsu'  
            }
        }

        stage("build") {
            steps {
                // echo 'building the application...'
                // sh 'doctl registry repo list-v2'
                // sh "docker build -t capstone-frontend:${version} ."
                // sh "docker tag capstone-frontend:${version} registry.digitalocean.com/capstone-ccsu/capstone-frontend:${version}"
                // sh "docker push registry.digitalocean.com/capstone-ccsu/capstone-frontend:${version}"
                // sh 'doctl registry repo list-v2'

                echo 'building the application...'
                // sh 'doctl registry repo list-v2'
                sh 'docker build -t "${containerName}:${version}" .'
                sh 'docker tag "${containerName}:${version}" stoicllama/"${containerName}:${version}"'
                sh 'docker push stoicllama/"${containerName}:${version}"'
                // sh 'doctl registry repo list-v2'
            }
        }

        stage("test") {
            steps {
                echo 'testing the application...'  
                
                script {
                        // Use SSH to check if the container exists. 
                        // If not exists, capture error so Jenkins can continue.
                        def containerExists = sh(script: 'docker stop "${containerName}"', returnStatus: true)

                        echo "containerExists: $containerExists"
                }

                sh '''docker run -d \
                        -p 7010:7010 \
                        -e PORT=7010 \
                        -e API_VERSION=1 \
                        --rm \
                        --name ${containerName} \
                        --network monitoring \
                        -v /var/run/docker.sock:/var/run/docker.sock \
                        -v capstone_home:/var/capstone_home \
                        stoicllama/${containerName}:${version}
                        
                        docker ps
                '''

'
                sh 'docker exec ${containerName} sh'

                sh 'npm run test'

                sh '/var/capstone_home/validate_test_results.sh'  
            }
        }

        stage("deploy") {
            steps {
                echo 'deploying the application...' 
                
                withCredentials([
                    string(credentialsId: 'website', variable: 'WEBSITE'),
                ]) {
                    script {
                        // Use SSH to check if the container exists. 
                        // If not exists, capture error so Jenkins can continue.
                        def containerExists = sh(script: 'ssh -i /var/jenkins_home/.ssh/website_deploy_rsa_key "${WEBSITE}" docker stop "${containerName}"', returnStatus: true)

                        echo "containerExists: $containerExists"
                    }
                }

                // Use the withCredentials block to access the credentials
                // Note: need --rm when docker run.. so that docker stop can kill it cleanly
                withCredentials([
                    string(credentialsId: 'website', variable: 'WEBSITE'),
                ]) {
                    sh '''
                        ssh -i /var/jenkins_home/.ssh/website_deploy_rsa_key ${WEBSITE} "docker run -d \
                        -p 7010:7010 \
                        -e PORT=7010 \
                        -e API_VERSION=1 \
                        --rm \
                        --name ${containerName} \
                        --network monitoring \
                        -v /var/run/docker.sock:/var/run/docker.sock \
                        stoicllama/${containerName}:${version}
                        
                        docker ps
                        "
                    '''
                }
            }

        }
    }

    post {
        always {
            echo "Release finished and start clean up"
            deleteDir() // the actual folder with the downloaded project code is deleted from build server
        }
        success {
            echo "Release Success"
        }
        failure {
            echo "Release Failed"
        }
        cleanup {
            echo "Clean up in post workspace" 
            cleanWs() // any reference this particular build is deleted from the agent
        }
    }

}