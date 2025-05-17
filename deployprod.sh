#!/bin/bash

set -e # Exit immediately if a command exits with a non-zero status.

PROJECT_ID="aiagentapi"
echo "Configuring project: ${PROJECT_ID}"

# Ensure gcloud is configured for the correct project
gcloud config set project ${PROJECT_ID}

echo "Enabling necessary APIs..."
gcloud services enable run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    iam.googleapis.com

# Create Artifact Registry (if it doesn't exist - add --quiet to suppress y/n)
# Replace with your desired repo name and region
ARTIFACT_REPO_NAME="frontend-docker-repo" # Or YOUR_ARTIFACT_REGISTRY_REPO
REGION="us-central1" # Or YOUR_REGION

echo "Checking for Artifact Registry repository: ${ARTIFACT_REPO_NAME} in ${REGION}..."
if ! gcloud artifacts repositories describe ${ARTIFACT_REPO_NAME} --location=${REGION} --project=${PROJECT_ID} &> /dev/null; then
  echo "Creating Artifact Registry repository: ${ARTIFACT_REPO_NAME}..."
  gcloud artifacts repositories create ${ARTIFACT_REPO_NAME} \
      --repository-format=docker \
      --location=${REGION} \
      --description="Docker repository for wealthaiagent frontend" \
      --project=${PROJECT_ID}
else
  echo "Artifact Registry repository ${ARTIFACT_REPO_NAME} already exists."
fi


PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')

if [ -z "${PROJECT_NUMBER}" ]; then
  echo "Error: Could not retrieve project number for project ${PROJECT_ID}."
  exit 1
fi
echo "Project Number: ${PROJECT_NUMBER}"

CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
echo "Cloud Build Service Account email: serviceAccount:${CLOUD_BUILD_SA}"

# --- More Robust IAM Policy Update ---
echo "Updating IAM policy for Cloud Build service account..."

# Roles to ensure the Cloud Build SA has
declare -a roles_to_add=(
  "roles/run.admin"
  "roles/artifactregistry.writer"
  "roles/iam.serviceAccountUser"
)

# Get current IAM policy
gcloud projects get-iam-policy ${PROJECT_ID} --format=json > /tmp/iam_policy.json

# Loop through roles and add them if not already present without a condition
for role_to_add in "${roles_to_add[@]}"; do
  echo "Checking/Adding role: ${role_to_add}"
  # Check if the member already has the role UNCONDITIONALLY
  # Note: jq query needs to be precise. This is a simplified check.
  # A more robust check would see if the role exists in an unconditional binding for the member.
  if ! jq -e --arg role "$role_to_add" --arg member "serviceAccount:${CLOUD_BUILD_SA}" \
    '.bindings[] | select(.role == $role and (.condition == null or .condition | length == 0) and (.members[] | contains($member)))' \
    /tmp/iam_policy.json > /dev/null; then
    echo "Adding unconditional binding for ${role_to_add} to ${CLOUD_BUILD_SA}"
    
    # Create a temporary policy snippet for the new binding
    cat <<EOF > /tmp/add_binding.json
{
  "policy": {
    "bindings": [
      {
        "role": "${role_to_add}",
        "members": [
          "serviceAccount:${CLOUD_BUILD_SA}"
        ]
      }
    ]
  }
}
EOF
    # Merge this new binding into the existing policy
    # This is a bit complex with jq. A simpler, though less idempotent, way is to use add-iam-policy-binding
    # and hope gcloud handles the merge or use the Google Cloud Console for one-time setup.
    # For scripting, `gcloud projects set-iam-policy` with a fully formed policy is best.

    # Given the complexity of jq merging, let's try add-iam-policy-binding but be aware it might prompt if other conditions exist.
    # The core issue is the interactive prompt which `add-iam-policy-binding` might fall back to.
    # The most script-friendly way if `add-iam-policy-binding` keeps prompting is:
    # 1. Get policy
    # 2. Programmatically modify the JSON (e.g., with Python or a more capable jq script)
    # 3. Set policy
    #
    # However, often the issue is that the SA for impersonation (iam.serviceAccountUser)
    # needs to be specified for *which* SA it can impersonate.
    # For Cloud Run, the CB SA needs to be able to use the Run Time Service Account.
    # Let's assume the default compute SA is used by Cloud Run.
    RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

    if [ "$role_to_add" == "roles/iam.serviceAccountUser" ]; then
        echo "Granting ${CLOUD_BUILD_SA} the ability to impersonate ${RUNTIME_SA}"
        gcloud iam service-accounts add-iam-policy-binding ${RUNTIME_SA} \
          --project=${PROJECT_ID} \
          --role="roles/iam.serviceAccountTokenCreator" \
          --member="serviceAccount:${CLOUD_BUILD_SA}" \
          --quiet
    else
        # This command might still prompt if other complex conditions exist on the project for this member/role.
        # The --condition=None flag *should* work but gcloud behavior can be nuanced.
        gcloud projects add-iam-policy-binding ${PROJECT_ID} \
            --member="serviceAccount:${CLOUD_BUILD_SA}" \
            --role="${role_to_add}" \
            --condition=None \
            --quiet # Add --quiet to attempt non-interactive
    fi
  else
    echo "Role ${role_to_add} is already present unconditionally or managed elsewhere."
  fi
done

rm /tmp/iam_policy.json
rm /tmp/add_binding.json 2>/dev/null || true


echo "IAM permissions configured (or attempted)."
echo "If you still face IAM issues or prompts, consider setting these permissions manually once via the Google Cloud Console."

# --- Trigger Cloud Build ---
# Assuming cloudbuild.yaml is in the frontend directory, and you are running this script from the repo root
echo "Submitting build to Google Cloud Build..."
# Replace placeholders in substitutions or directly in cloudbuild.yaml
SERVICE_NAME="wealthaiagent-frontend" # Example for substitution

gcloud builds submit . \
    --config=cloudbuild.yaml \
    --project=${PROJECT_ID} \
    --substitutions=_REGION=${REGION},_ARTIFACT_REPO=${ARTIFACT_REPO_NAME},_SERVICE_NAME=${SERVICE_NAME} \
    --quiet

echo "Build submitted. Check Google Cloud Console for progress."
echo "Service will be available at a URL like https://${SERVICE_NAME}-<hash>-${REGION}.a.run.app/chataiagent/"
echo "Remember to set up your custom domain and Load Balancer for yourfinadvisor.com/chataiagent"