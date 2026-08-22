.PHONY: dev

PYTHON ?= .venv/bin/python

dev:
	@$(PYTHON) -m uvicorn app.main:app --reload & \
	service_pid=$$!; \
	trap 'kill $$service_pid 2>/dev/null || true' EXIT INT TERM; \
	npm --prefix ui start
