SHELL := /bin/bash

GITHUB_PATH := $HOME/VideoStreamDemo/Remote-GUI

BACKEND_DIR := $(GITHUB_PATH)/CLI/local-cli-backend
BACKEND_APP := $(BACKEND_DIR)/main.py
FRONTEND_DIR := $(GITHUB_PATH)/CLI/local-cli-fe-full

PID_DIR := $(GITHUB_PATH)/.pids
BACKEND_PID := $(PID_DIR)/backend.pid
FRONTEND_PID := $(PID_DIR)/frontend.pid

BACKEND_PORT := 8000
FRONTEND_PORT := 3000

.PHONY: up backend frontend clean status logs

up: backend frontend
	@echo "Servers started. Stop with: make clean"

backend:
	@mkdir -p "$(PID_DIR)"
	@if lsof -ti tcp:$(BACKEND_PORT) >/dev/null 2>&1; then \
		echo "Backend already running on port $(BACKEND_PORT)"; \
	else \
		echo "Starting FastAPI backend on port $(BACKEND_PORT)..."; \
		nohup bash -lc 'cd "$(BACKEND_DIR)" && exec fastapi dev "$(BACKEND_APP)" --host 0.0.0.0 --port $(BACKEND_PORT)' \
			> "$(PID_DIR)/backend.log" 2>&1 & \
		echo $$! > "$(BACKEND_PID)"; \
		echo "Backend starter PID: $$(cat "$(BACKEND_PID)")"; \
	fi

frontend:
	@mkdir -p "$(PID_DIR)"
	@if lsof -ti tcp:$(FRONTEND_PORT) >/dev/null 2>&1; then \
		echo "Frontend already running on port $(FRONTEND_PORT)"; \
	else \
		echo "Starting frontend on port $(FRONTEND_PORT)..."; \
		nohup bash -lc 'cd "$(FRONTEND_DIR)" && exec npm start' \
			> "$(PID_DIR)/frontend.log" 2>&1 & \
		echo $$! > "$(FRONTEND_PID)"; \
		echo "Frontend starter PID: $$(cat "$(FRONTEND_PID)")"; \
	fi

status:
	@echo -n "Backend (port $(BACKEND_PORT)):  "
	@if lsof -ti tcp:$(BACKEND_PORT) >/dev/null 2>&1; then echo "RUNNING"; else echo "STOPPED"; fi
	@echo -n "Frontend (port $(FRONTEND_PORT)): "
	@if lsof -ti tcp:$(FRONTEND_PORT) >/dev/null 2>&1; then echo "RUNNING"; else echo "STOPPED"; fi
	@echo "Logs: $(PID_DIR)/backend.log , $(PID_DIR)/frontend.log"

logs:
	@tail -n 50 -f "$(PID_DIR)/backend.log" "$(PID_DIR)/frontend.log"

clean:
	@echo "Stopping servers..."
	@set +e; \
	echo "Killing anything listening on backend port $(BACKEND_PORT)..."; \
	lsof -ti tcp:$(BACKEND_PORT) | xargs -r kill -TERM 2>/dev/null; \
	sleep 1; \
	lsof -ti tcp:$(BACKEND_PORT) | xargs -r kill -KILL 2>/dev/null; \
	echo "Killing anything listening on frontend port $(FRONTEND_PORT)..."; \
	lsof -ti tcp:$(FRONTEND_PORT) | xargs -r kill -TERM 2>/dev/null; \
	sleep 1; \
	lsof -ti tcp:$(FRONTEND_PORT) | xargs -r kill -KILL 2>/dev/null; \
	rm -f "$(BACKEND_PID)" "$(FRONTEND_PID)"; \
	echo "Done."
