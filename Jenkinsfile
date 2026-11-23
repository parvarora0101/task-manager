pipeline {
    agent { label 'task-builder' }
    options {
        disableConcurrentBuilds()
        timestamps()
        timeout(time: 25, unit: 'MINUTES')
    }
    triggers { githubPush() }
    parameters {
        string(name: 'IMAGE_REPOSITORY', defaultValue: '', description: 'Registry repository, e.g. docker.io/account/task-manager')
        booleanParam(name: 'PUBLISH', defaultValue: false, description: 'Publish from the trusted main branch')
    }
    stages {
        stage('Test') {
            steps {
                sh 'node --version && npm test'
            }
        }
        stage('SonarQube') {
            when { branch 'main' }
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh 'sonar-scanner'
                }
            }
        }
        stage('Quality gate') {
            when { branch 'main' }
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }
        stage('Build and smoke test') {
            steps {
                sh '''
                    set -eu
                    image="task-manager-ci:$BUILD_NUMBER"
                    docker build --pull -t "$image" .
                    docker run --rm -d --name "task-ci-$BUILD_TAG" --read-only --cap-drop ALL                       --security-opt no-new-privileges --tmpfs /data:uid=1000,gid=1000,mode=0700 "$image"
                    for attempt in $(seq 1 20); do
                      if docker exec "task-ci-$BUILD_TAG" node -e "fetch('http://127.0.0.1:3000/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"; then
                        exit 0
                      fi
                      sleep 1
                    done
                    docker logs "task-ci-$BUILD_TAG"
                    exit 1
                '''
            }
        }
        stage('Scan image') {
            steps {
                sh 'trivy image --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed "task-manager-ci:$BUILD_NUMBER"'
            }
        }
        stage('Publish') {
            when {
                allOf {
                    branch 'main'
                    expression { params.PUBLISH }
                }
            }
            steps {
                withCredentials([usernamePassword(credentialsId: 'registry-publisher',
                    usernameVariable: 'REGISTRY_USER', passwordVariable: 'REGISTRY_PASSWORD')]) {
                    sh '''
                        set -eu
                        case "$IMAGE_REPOSITORY" in */*) ;; *) exit 2 ;; esac
                        registry="${IMAGE_REPOSITORY%%/*}"
                        DOCKER_CONFIG=$(mktemp -d)
                        export DOCKER_CONFIG
                        trap 'rm -rf "$DOCKER_CONFIG"' EXIT
                        set +x
                        printf '%s' "$REGISTRY_PASSWORD" | docker login "$registry" -u "$REGISTRY_USER" --password-stdin
                        remote="$IMAGE_REPOSITORY:$GIT_COMMIT"
                        docker tag "task-manager-ci:$BUILD_NUMBER" "$remote"
                        docker push "$remote"
                        docker inspect --format='{{range .RepoDigests}}{{println .}}{{end}}' "$remote" > image-digest.txt
                    '''
                }
                archiveArtifacts artifacts: 'image-digest.txt', fingerprint: true
            }
        }
    }
    post {
        always {
            sh 'docker rm -f "task-ci-$BUILD_TAG" >/dev/null 2>&1 || true'
        }
    }
}
