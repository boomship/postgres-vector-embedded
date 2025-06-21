# PostgreSQL + pgvector embedded build
# Latest versions as of 2025-06-21

POSTGRES_VERSION = 17.2
PGVECTOR_VERSION = 0.8.0

# Platform detection
UNAME_S := $(shell uname -s)
UNAME_M := $(shell uname -m)

ifeq ($(UNAME_S),Darwin)
    PLATFORM = darwin
    ifeq ($(UNAME_M),arm64)
        ARCH = arm64
    else
        ARCH = x64
    endif
else ifeq ($(UNAME_S),Linux)
    PLATFORM = linux
    ifeq ($(UNAME_M),x86_64)
        ARCH = x64
    else ifeq ($(UNAME_M),aarch64)
        ARCH = arm64
    else
        ARCH = $(UNAME_M)
    endif
else
    PLATFORM = win32
    ARCH = x64
endif

# Directories
BUILD_DIR = build
DIST_DIR = dist
POSTGRES_SRC = $(BUILD_DIR)/postgresql-$(POSTGRES_VERSION)
PGVECTOR_SRC = $(BUILD_DIR)/pgvector-$(PGVECTOR_VERSION)
INSTALL_DIR = $(DIST_DIR)/postgres-$(PLATFORM)-$(ARCH)

# URLs
POSTGRES_URL = https://ftp.postgresql.org/pub/source/v$(POSTGRES_VERSION)/postgresql-$(POSTGRES_VERSION).tar.gz
PGVECTOR_URL = https://github.com/pgvector/pgvector/archive/v$(PGVECTOR_VERSION).tar.gz

# Build configuration
PREFIX = $(CURDIR)/$(INSTALL_DIR)

# Build configuration - minimal for now with macOS compatibility
ifeq ($(PLATFORM),darwin)
    CONFIGURE_FLAGS = --prefix=$(PREFIX) --without-openssl --without-icu --disable-nls CFLAGS="-Wno-unguarded-availability-new"
else ifeq ($(PLATFORM)-$(ARCH),linux-arm64)
    CONFIGURE_FLAGS = --prefix=$(PREFIX) --without-openssl --without-icu --disable-nls --host=aarch64-linux-gnu CC=aarch64-linux-gnu-gcc
else
    CONFIGURE_FLAGS = --prefix=$(PREFIX) --without-openssl --without-icu --disable-nls
endif

.PHONY: all build clean download extract configure compile install package test

all: build

build: download extract configure compile install package

test: build
	@echo "🧪 Testing built binaries..."
	./test-binaries.sh

download:
	@echo "📦 Downloading PostgreSQL $(POSTGRES_VERSION) and pgvector $(PGVECTOR_VERSION)..."
	mkdir -p $(BUILD_DIR)
	cd $(BUILD_DIR) && \
		curl -L $(POSTGRES_URL) -o postgresql-$(POSTGRES_VERSION).tar.gz && \
		curl -L $(PGVECTOR_URL) -o pgvector-$(PGVECTOR_VERSION).tar.gz

extract:
	@echo "📂 Extracting source archives..."
	cd $(BUILD_DIR) && \
		tar -xzf postgresql-$(POSTGRES_VERSION).tar.gz && \
		tar -xzf pgvector-$(PGVECTOR_VERSION).tar.gz

configure:
	@echo "⚙️  Configuring PostgreSQL build..."
	cd $(POSTGRES_SRC) && ./configure $(CONFIGURE_FLAGS)

compile:
	@echo "🔨 Generating headers..."
	cd $(POSTGRES_SRC) && make -C ./src/backend generated-headers
	@echo "🔨 Compiling PostgreSQL..."
	cd $(POSTGRES_SRC) && make -j$(shell nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

install:
	@echo "📦 Installing PostgreSQL..."
	mkdir -p $(INSTALL_DIR)
	cd $(POSTGRES_SRC) && make install
	@echo "🔨 Compiling pgvector..."
ifeq ($(PLATFORM)-$(ARCH),linux-arm64)
	cd $(PGVECTOR_SRC) && make PG_CONFIG=$(PREFIX)/bin/pg_config CC=aarch64-linux-gnu-gcc
else
	cd $(PGVECTOR_SRC) && make PG_CONFIG=$(PREFIX)/bin/pg_config
endif
	@echo "📦 Installing pgvector..."
	cd $(PGVECTOR_SRC) && make install PG_CONFIG=$(PREFIX)/bin/pg_config

package:
	@echo "📦 Creating distribution package..."
	cd $(DIST_DIR) && tar -czf postgres-$(PLATFORM)-$(ARCH).tar.gz postgres-$(PLATFORM)-$(ARCH)/
	@echo "✅ Built: $(DIST_DIR)/postgres-$(PLATFORM)-$(ARCH).tar.gz"

clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf $(BUILD_DIR) $(DIST_DIR)

info:
	@echo "Platform: $(PLATFORM)-$(ARCH)"
	@echo "PostgreSQL: $(POSTGRES_VERSION)"
	@echo "pgvector: $(PGVECTOR_VERSION)"
	@echo "Install dir: $(INSTALL_DIR)"