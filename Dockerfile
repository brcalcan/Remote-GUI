# syntax=docker/dockerfile:1

# =====================
# Frontend build stage
# =====================
FROM node:20-slim AS frontend-build
WORKDIR /app

# Install system deps for native npm packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package.json and install deps
COPY CLI/local-cli-fe-full/package.json ./

RUN npm install --legacy-peer-deps --no-audit --progress=false

# Copy frontend source (node_modules must be excluded in .dockerignore)
COPY CLI/local-cli-fe-full ./

# Build-time API URL (passed in by docker-compose, defaults to backend port)
ARG VITE_API_URL=http://127.0.0.1:8080
ENV VITE_API_URL=${VITE_API_URL}


# Build frontend
RUN npm run build

# =====================
# Backend build stage
# =====================
FROM python:3.13.12-slim AS backend-build
WORKDIR /app
ENV DEBIAN_FRONTEND=noninteractive

# Install system deps for virtualenv + build
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-venv build-essential git curl xsel \
    && rm -rf /var/lib/apt/lists/*



# Create virtual environment
RUN python3 -m venv /opt/venv
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Copy Python dependencies and install in virtualenv
COPY requirements.txt .

RUN pip install --upgrade "pip>=26.0" "wheel>=0.45.1" "setuptools>=78.1.1" \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install uv

# Clone AnyLog-API and install into virtualenv
RUN git clone --branch main --depth 1 https://github.com/AnyLog-co/AnyLog-API /tmp/AnyLog-API \
    && cd /tmp/AnyLog-API \
    && python setup.py sdist bdist_wheel \
    && pip install --no-cache-dir dist/*.whl \
    && rm -rf /tmp/AnyLog-API

# Copy backend source and templates
COPY CLI/ CLI/
COPY templates/ templates/
COPY start.sh start.sh
RUN chmod +x start.sh

# =====================
# Final runtime image
# =====================
FROM python:3.13.12-slim AS final
WORKDIR /app

ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# User-defined at deployment via -e or --build-arg
ENV CLI_IP=0.0.0.0
ARG EXPOSE_PORT=8080
ENV CLI_PORT=${EXPOSE_PORT}

# Install runtime deps (xsel + node tooling for plugin frontend builds)
RUN apt-get update && apt-get install -y --no-install-recommends xsel nodejs npm && \
    apt-get install -y --only-upgrade openssl && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd -r anylog && useradd -r -g anylog -d /app anylog


# Copy venv from backend-build
COPY setup.cfg /app/setup.cfg
COPY --from=backend-build /opt/venv /opt/venv

# Copy backend source + templates + start.sh
COPY --from=backend-build /app/CLI CLI/
COPY --from=backend-build /app/templates templates/
COPY --from=backend-build /app/start.sh start.sh

# Copy frontend build
COPY --from=frontend-build /app/build /app/CLI/local-cli-fe-full/build

# Ensure start.sh is executable
RUN sed -i 's/\r$//' start.sh && chmod +x start.sh

EXPOSE ${EXPOSE_PORT}

# add THIS
RUN chown -R anylog:anylog /app

# switch user
USER anylog

ENTRYPOINT ["/app/start.sh"]
