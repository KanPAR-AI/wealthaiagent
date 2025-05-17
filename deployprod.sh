#!/bin/bash

# frontend/deployprod.sh

set -e # Exit immediately if a command exits with a non-zero status.

PROJECT_ID="aiagentapi"
echo "Configuring project: ${PROJECT_ID}"

# Ensure gcloud is configured for the correct project
gcloud config set project ${PROJECT_ID}

echo "Enabling necessary APIs..."
gcloud services enable run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    iam.googleapis.com --project=${PROJECT_ID} --quiet

# Configuration for your deployment
ARTIFACT_REPO_NAME="frontend-docker-repo" # Your chosen Artifact Registry repository name
REGION="us-central1"                 # Your chosen Google Cloud region
SERVICE_NAME="wealthaiagent-frontend"  # Your chosen Cloud Run service name

echo "Checking for Artifact Registry repository: ${ARTIFACT_REPO_NAME} in ${REGION}..."
if ! gcloud artifacts repositories describe ${ARTIFACT_REPO_NAME} --location=${REGION} --project=${PROJECT_ID} &> /dev/null; then
  echo "Creating Artifact Registry repository: ${ARTIFACT_REPO_NAME}..."
  gcloud artifacts repositories create ${ARTIFACT_REPO_NAME} \
      --repository-format=docker \
      --location=${REGION} \
      --description="Docker repository for ${SERVICE_NAME}" \
      --project=${PROJECT_ID} --quiet
else
  echo "Artifact Registry repository ${ARTIFACT_REPO_NAME} already exists."
fi


PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')

if [ -z "${PROJECT_NUMBER}" ]; then
  echo "Error: Could not retrieve project number for project ${PROJECT_ID}."
  exit 1
fi
echo "Project Number: ${PROJECT_NUMBER}"

CLOUD_BUILD_SA_EMAIL="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
CLOUD_BUILD_SA_MEMBER="serviceAccount:${CLOUD_BUILD_SA_EMAIL}"
echo "Cloud Build Service Account member: ${CLOUD_BUILD_SA_MEMBER}"

# Cloud Run runtime service account (default is Compute Engine default SA)
RUNTIME_SA_EMAIL="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant necessary IAM roles to the Cloud Build Service Account
# These are generally idempotent; --quiet suppresses verbose output.
echo "Ensuring Cloud Build SA has project-level roles..."
declare -a project_roles_to_ensure=(
  "roles/run.admin"               # To deploy and manage Cloud Run services
  "roles/artifactregistry.writer" # To push images to Artifact Registry
)
for role_to_add in "${project_roles_to_ensure[@]}"; do
  echo "Attempting to grant ${role_to_add} to ${CLOUD_BUILD_SA_MEMBER} on project ${PROJECT_ID}..."
  gcloud projects add-iam-policy-binding ${PROJECT_ID} \
      --member="${CLOUD_BUILD_SA_MEMBER}" \
      --role="${role_to_add}" \
      --condition=None \
      --quiet || echo "Warning: Failed to add ${role_to_add} or it might already exist with conditions. Check console if issues persist."
done

echo "Ensuring Cloud Build SA (${CLOUD_BUILD_SA_MEMBER}) can impersonate Cloud Run runtime SA (${RUNTIME_SA_EMAIL})..."
gcloud iam service-accounts add-iam-policy-binding ${RUNTIME_SA_EMAIL} \
    --project=${PROJECT_ID} \
    --role="roles/iam.serviceAccountTokenCreator" \
    --member="${CLOUD_BUILD_SA_MEMBER}" \
    --quiet || echo "Warning: Failed to grant Service Account Token Creator. Check console if issues persist."

echo "IAM permission setup attempted."
echo "If you still face IAM issues or prompts for these roles, consider setting them manually once via the Google Cloud Console."

# --- Trigger Cloud Build ---
echo "Submitting build to Google Cloud Build..."
# For manual builds, generate a unique tag
MANUAL_TAG_VALUE="manual-$(date +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD)"

# Assuming this script is inside the 'frontend' directory, and 'cloudbuild.yaml' is also there.
# The '.' indicates that the current directory (frontend/) is the source for the build.
gcloud builds submit . \
    --config=cloudbuild.yaml \
    --project=${PROJECT_ID} \
    --substitutions=_REGION=${REGION},_ARTIFACT_REPO=${ARTIFACT_REPO_NAME},_SERVICE_NAME=${SERVICE_NAME},_MANUAL_TAG=${MANUAL_TAG_VALUE} \
    --quiet

BUILD_STATUS=$? # Capture exit status of the build submit

if [ ${BUILD_STATUS} -eq 0 ]; then
    echo "Build submitted successfully."
    echo "Check Google Cloud Console for progress: https://console.cloud.google.com/cloud-build/builds?project=${PROJECT_ID}"
    echo "Once deployed, service might be available at a URL like https://${SERVICE_NAME}-<hash>-${REGION}.a.run.app/chataiagent/"
    echo "Remember to set up your custom domain and Load Balancer for yourfinadvisor.com/chataiagent"
else
    echo "ERROR: Cloud Build submission failed with status ${BUILD_STATUS}."
    exit ${BUILD_STATUS}
fi