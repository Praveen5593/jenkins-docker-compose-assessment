pipeline {
    agent any

    environment {
        IMAGE_REPO = "employee-app"
        IMAGE_TAG  = "${BUILD_NUMBER}"
        IMAGE_NAME = "${IMAGE_REPO}:${IMAGE_TAG}"
        COMPOSE_FILE = "docker-compose.yml"
    }

    stages {
        stage('Checkout') {
            steps { checkout scm }
        }

        stage('Install & Test') {
            steps {
                dir('app') {
                    sh 'npm install'
                    sh 'npm test'
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                sh 'docker build -t ${IMAGE_NAME} ./app'
            }
        }

        stage('Trivy Security Scan') {
            steps {
                sh '''
                  mkdir -p reports
                  trivy image --severity HIGH,CRITICAL --format table \
                    --output reports/trivy-report.txt ${IMAGE_NAME} || true

                  trivy image --severity HIGH,CRITICAL --exit-code 1 \
                    --ignore-unfixed ${IMAGE_NAME}
                '''
            }
        }

        stage('Prepare Deployment') {
            steps {
                sh '''
                  test -f .env || { echo ".env is missing"; exit 1; }

                  if [ -f .last_successful_image ]; then
                    cp .last_successful_image .rollback_image
                  fi

                  sed -i '/^APP_IMAGE=/d' .env
                  echo "APP_IMAGE=${IMAGE_NAME}" >> .env
                '''
            }
        }

        stage('Deploy with Docker Compose') {
            steps {
                sh '''
                  docker compose -f ${COMPOSE_FILE} --env-file .env up -d
                  docker compose -f ${COMPOSE_FILE} --env-file .env ps
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                  set -a
                  . ./.env
                  set +a

                  for i in $(seq 1 20); do
                    if curl -fsS "http://127.0.0.1:${HOST_PORT}/health"; then
                      echo
                      echo "Application is healthy"
                      exit 0
                    fi
                    sleep 5
                  done

                  docker compose -f ${COMPOSE_FILE} --env-file .env ps
                  docker compose -f ${COMPOSE_FILE} --env-file .env logs --tail=100 app
                  exit 1
                '''
            }
        }

        stage('Mark Successful Image') {
            steps {
                sh 'echo "${IMAGE_NAME}" > .last_successful_image'
            }
        }

        stage('Image Cleanup') {
            steps {
                sh '''
                  docker image prune -f
                  docker builder prune -f
                '''
            }
        }
    }

    post {
        success {
            archiveArtifacts artifacts: 'reports/trivy-report.txt', allowEmptyArchive: true
            echo 'Pipeline completed successfully'
        }

        failure {
            echo 'Pipeline failed; attempting rollback'
            sh '''
              if [ -f .rollback_image ] && [ -f .env ]; then
                ROLLBACK_IMAGE=$(cat .rollback_image)
                if docker image inspect "$ROLLBACK_IMAGE" >/dev/null 2>&1; then
                  sed -i '/^APP_IMAGE=/d' .env
                  echo "APP_IMAGE=$ROLLBACK_IMAGE" >> .env
                  docker compose -f ${COMPOSE_FILE} --env-file .env up -d
                  echo "Rollback deployed: $ROLLBACK_IMAGE"
                else
                  echo "Previous image not found locally; rollback skipped"
                fi
              else
                echo "No previous successful image recorded"
              fi
            '''
            archiveArtifacts artifacts: 'reports/trivy-report.txt', allowEmptyArchive: true
        }

        always {
            sh 'rm -f .rollback_image || true'
        }
    }
}
