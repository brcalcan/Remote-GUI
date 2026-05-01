#!/bin/bash
# ------------------------------------------------------------------------------
# build.sh — Build AnyLog-Network Docker image(s), optionally pushing to Docker Hub
#
# What it does:
#   - Detects the host CPU architecture if no platform is specified
#   - Derives the image tag from setup.cfg (version + short commit hash)
#     if no tag is provided
#   - For a single platform: tags the image as <tag>-<arch> (e.g. 1.4.2603-e1fb6a-amd64)
#     and loads it into the local Docker daemon (--load)
#   - For multiple platforms: builds a multi-arch manifest tagged as <tag>
#     (e.g. 1.4.2603-e1fb6a) and pushes directly to Docker Hub (--push),
#     which is required by buildx for multi-arch manifests
#   - If --push is passed for a single-platform build, pushes to Docker Hub
#     instead of loading locally
#
# Prerequisites:
#   - Docker buildx with a docker-container driver:
#       docker buildx create --use --name multiarch
#       docker buildx inspect --bootstrap
#   - QEMU for cross-arch builds:
#       docker run --privileged --rm tonistiigi/binfmt --install all
#   - Logged in to Docker Hub (required when using --push):
#       docker login
#
# Usage:
#   bash build.sh [--tag TAG] [--platform PLATFORM] [--push]
#
#   --tag       Image tag. Defaults to <version>-<short-commit> from setup.cfg
#                 e.g. 1.4.2603-e1fb6a
#   --platform  Target platform(s). Defaults to the host architecture.
#                 Single : linux/amd64
#                 Multi  : linux/arm64,linux/amd64
#   --push      Push the image to Docker Hub instead of loading locally.
#               Required for multi-arch builds (buildx cannot --load multi-arch).
#
# Examples:
#   bash build.sh                                                       # auto tag, host arch, local
#   bash build.sh --push                                                # auto tag, host arch, push
#   bash build.sh --tag 1.4.2603-e1fb6a                                # explicit tag, host arch, local
#   bash build.sh --platform linux/arm64                                # auto tag, single arch, local
#   bash build.sh --tag 1.4.2603-e1fb6a --platform linux/arm64 --push  # explicit tag, single arch, push
#   bash build.sh --platform linux/arm64,linux/amd64 --push            # auto tag, multi-arch, push
# ------------------------------------------------------------------------------
# set -e  — Uncomment to abort immediately if any command exits with a non-zero
#           status. Useful in CI/CD pipelines where silent failures are dangerous.
#           Leave commented for interactive use where you want to inspect errors
#           and continue manually, or when you have explicit error handling (||)
#           that set -e would interfere with.
set -e

TAG=""
PLATFORM=""
PUSH=false 

# Parse named flags
while [[ $# -gt 0 ]] ; do
  case $1 in
    --tag)      TAG=$2;      shift 2 ;;
    --platform) PLATFORM=$2; shift 2 ;;
    --push)     PUSH=true;    shift 1 ;; 
    *) echo "Unknown option: $1" ; exit 1 ;;
  esac
done

# Default platform to host arch if not specified
if [[ -z ${PLATFORM} ]] ; then
  PLATFORM="linux/$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')"
fi
ARCH=${PLATFORM#*/}   # strips "linux/" → e.g. "amd64" or "arm64"

# Default tag to <version>-<short-commit> from setup.cfg if not specified
if [[ -z ${TAG} ]] ; then
  TAG_VERSION=$(grep ^version setup.cfg | awk -F " = " '{print $2}' | awk -F " " '{print $1}' | xargs)
  TAG_COMMIT=$(grep ^version setup.cfg | grep -oE '[a-f0-9]{6,}' | tail -1)
  TAG=${TAG_VERSION}-${TAG_COMMIT}
fi

# Single platform: append arch suffix; multi-platform: use bare tag
IMAGE_NAME=anylogco/remote-gui:${TAG}
if [[ ! ${PLATFORM} == *","* ]] ; then
  IMAGE_NAME=${IMAGE_NAME}-${ARCH}
fi

DOCKER_CMD="docker buildx build \
    --platform ${PLATFORM} \
    --sbom=true \
    --provenance=mode=max \
    --pull \
    -f Dockerfile . \
    -t ${IMAGE_NAME}"

if [[ "${PUSH}" == "true" ]] ; then 
   eval ${DOCKER_CMD} --push 
else 
   eval ${DOCKER_CMD} --load
fi 
 
echo "Built Image: ${IMAGE_NAME}"
