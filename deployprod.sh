#!/bin/bash

# frontend/deployprod.sh

set -e # Exit immediately if a command exits with a non-zero status.

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Google Cloud Platform Deployment     ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo -e "${RED}✗ .env.production not found!${NC}"
    echo -e "${YELLOW}  Create .env.production from config/env.production.example${NC}"
    exit 1
fi

# Load environment variables
set -a
source .env.production
set +a

# Validate production configuration
if [ "$VITE_BUILD_TARGET" != "production" ]; then
    echo -e "${YELLOW}⚠ Warning: VITE_BUILD_TARGET is not set to 'production'${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

PROJECT_ID="aiagentapi"
echo -e "${BLUE}Configuring project: ${PROJECT_ID}${NC}"

# Ensure gcloud is configured for the correct project
gcloud config set project ${PROJECT_ID} --quiet

echo -e "${YELLOW}Enabling necessary APIs...${NC}"
gcloud services enable run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    iam.googleapis.com --project=${PROJECT_ID} --quiet

# Configuration for your deployment
ARTIFACT_REPO_NAME="yourfinadvisor-repo" # Your chosen Artifact Registry repository name
REGION="us-central1"                 # Your chosen Google Cloud region
SERVICE_NAME="wealthaiagent-frontend"  # Your chosen Cloud Run service name

echo -e "${YELLOW}Checking for Artifact Registry repository: ${ARTIFACT_REPO_NAME} in ${REGION}...${NC}"
if ! gcloud artifacts repositories describe ${ARTIFACT_REPO_NAME} --location=${REGION} --project=${PROJECT_ID} &> /dev/null; then
  echo -e "${YELLOW}Creating Artifact Registry repository: ${ARTIFACT_REPO_NAME}...${NC}"
  gcloud artifacts repositories create ${ARTIFACT_REPO_NAME} \
      --repository-format=docker \
      --location=${REGION} \
      --description="Docker repository for ${SERVICE_NAME}" \
      --project=${PROJECT_ID} --quiet
else
  echo -e "${GREEN}✓ Artifact Registry repository ${ARTIFACT_REPO_NAME} already exists.${NC}"
fi

PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')

if [ -z "${PROJECT_NUMBER}" ]; then
  echo -e "${RED}✗ Error: Could not retrieve project number for project ${PROJECT_ID}.${NC}"
  exit 1
fi
echo -e "${BLUE}Project Number: ${PROJECT_NUMBER}${NC}"

CLOUD_BUILD_SA_EMAIL="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
CLOUD_BUILD_SA_MEMBER="serviceAccount:${CLOUD_BUILD_SA_EMAIL}"
echo -e "${BLUE}Cloud Build Service Account member: ${CLOUD_BUILD_SA_MEMBER}${NC}"

# Cloud Run runtime service account (default is Compute Engine default SA)
RUNTIME_SA_EMAIL="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant necessary IAM roles to the Cloud Build Service Account
echo -e "${YELLOW}Ensuring Cloud Build SA has project-level roles...${NC}"
declare -a project_roles_to_ensure=(
  "roles/run.admin"
  "roles/artifactregistry.writer"
)
for role_to_add in "${project_roles_to_ensure[@]}"; do
  echo -e "${YELLOW}Attempting to grant ${role_to_add} to ${CLOUD_BUILD_SA_MEMBER} on project ${PROJECT_ID}...${NC}"
  gcloud projects add-iam-policy-binding ${PROJECT_ID} \
      --member="${CLOUD_BUILD_SA_MEMBER}" \
      --role="${role_to_add}" \
      --condition=None \
      --quiet || echo -e "${YELLOW}⚠ Warning: Failed to add ${role_to_add} for ${CLOUD_BUILD_SA_MEMBER} on project ${PROJECT_ID}. It might already exist (possibly with conditions) or another issue occurred. Check IAM console if problems persist.${NC}"
done

echo -e "${YELLOW}Ensuring Cloud Build SA (${CLOUD_BUILD_SA_MEMBER}) can act as the Cloud Run runtime SA (${RUNTIME_SA_EMAIL})...${NC}"
gcloud iam service-accounts add-iam-policy-binding ${RUNTIME_SA_EMAIL} \
    --project=${PROJECT_ID} \
    --role="roles/iam.serviceAccountTokenCreator" \
    --member="${CLOUD_BUILD_SA_MEMBER}" \
    --quiet || echo -e "${YELLOW}⚠ Warning: Failed to grant Service Account Token Creator to ${CLOUD_BUILD_SA_MEMBER} for ${RUNTIME_SA_EMAIL}. Check IAM console if problems persist.${NC}"

echo -e "${GREEN}✓ IAM permission setup attempted.${NC}"

# Display deployment configuration
echo ""
echo -e "${GREEN}Deployment Configuration:${NC}"
echo -e "  API URL: ${VITE_API_BASE_URL}"
echo -e "  App Base Path: ${VITE_APP_BASE_PATH}"
echo -e "  Build Target: ${VITE_BUILD_TARGET}"
echo -e "  Service Name: ${SERVICE_NAME}"
echo -e "  Region: ${REGION}"
echo ""

# --- Trigger Cloud Build ---
echo -e "${YELLOW}Submitting build to Google Cloud Build...${NC}"
# For manual builds, generate a unique tag
# Using git rev-parse --short HEAD requires this script to be run from within a git repository.
# Adding a fallback if not in a git repo or no commits yet.
GIT_SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "nogit")
MANUAL_TAG_VALUE="manual-$(date +%Y%m%d-%H%M%S)-${GIT_SHORT_SHA}"

# Assuming this script is inside the 'frontend' directory, and 'cloudbuild.yaml' is also there.
# The '.' indicates that the current directory (frontend/) is the source for the build.
gcloud builds submit . \
    --config=cloudbuild.yaml \
    --project=${PROJECT_ID} \
    --substitutions=_REGION=${REGION},_ARTIFACT_REPO=${ARTIFACT_REPO_NAME},_SERVICE_NAME=${SERVICE_NAME},_TAG=${MANUAL_TAG_VALUE} \
    --quiet

BUILD_STATUS=$?

if [ ${BUILD_STATUS} -eq 0 ]; then
    echo "Build submitted successfully."
    echo "Check Google Cloud Console for progress: https://console.cloud.google.com/cloud-build/builds?project=${PROJECT_ID}"
    echo "Once deployed, service might be available at a URL like https://${SERVICE_NAME}-<hash>-${REGION}.a.run.app/chataiagent/"
    echo "Remember to set up your custom domain and Load Balancer for yourfinadvisor.com/chataiagent"
else
    echo "ERROR: Cloud Build submission failed with status ${BUILD_STATUS}."
    exit ${BUILD_STATUS}
fi