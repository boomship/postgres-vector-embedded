# PostgreSQL + pgvector embedded build
# Latest versions as of 2025-06-21

POSTGRES_VERSION = 17.5
PGVECTOR_VERSION = 0.8.0

# Platform detection - use environment variables if set, otherwise detect
ifndef PLATFORM
    UNAME_S := $(shell uname -s)
    ifeq ($(UNAME_S),Darwin)
        PLATFORM = darwin
    else ifeq ($(UNAME_S),Linux)
        PLATFORM = linux
    else
        PLATFORM = win32
    endif
endif

ifndef ARCH
    UNAME_M := $(shell uname -m)
    ifeq ($(UNAME_M),arm64)
        ARCH = arm64
    else ifeq ($(UNAME_M),aarch64)
        ARCH = arm64
    else ifeq ($(UNAME_M),x86_64)
        ARCH = x64
    else
        ARCH = x64
    endif
endif

# Variant detection - lite or full
ifndef VARIANT
    VARIANT = lite
endif

# Directories
BUILD_DIR = build
DIST_DIR = postgres-dist
POSTGRES_SRC = $(BUILD_DIR)/postgresql-$(POSTGRES_VERSION)
PGVECTOR_SRC = $(BUILD_DIR)/pgvector-$(PGVECTOR_VERSION)
INSTALL_DIR = $(DIST_DIR)/postgres-$(VARIANT)-$(PLATFORM)-$(ARCH)

# URLs
POSTGRES_URL = https://ftp.postgresql.org/pub/source/v$(POSTGRES_VERSION)/postgresql-$(POSTGRES_VERSION).tar.gz
PGVECTOR_URL = https://github.com/pgvector/pgvector/archive/v$(PGVECTOR_VERSION).tar.gz

# Build configuration
PREFIX = $(CURDIR)/$(INSTALL_DIR)

# Build configuration based on variant and platform
ifeq ($(VARIANT),lite)
    # Lite version: PostgreSQL + pgvector only (all platforms)
    CONFIGURE_FLAGS = --prefix=$(PREFIX) --disable-nls --without-openssl --without-icu --without-llvm --without-lz4 --without-zstd --without-libxml
else ifeq ($(VARIANT),full)
    # Full version: All enterprise features
    ifeq ($(PLATFORM),darwin)
        BREW_PREFIX := $(shell brew --prefix)
        ICU_PREFIX := $(BREW_PREFIX)/opt/icu4c
        LLVM_PREFIX := $(BREW_PREFIX)/opt/llvm
        CONFIGURE_FLAGS = --prefix=$(PREFIX) --with-openssl --with-icu --with-lz4 --with-zstd --with-libxml --with-llvm --with-uuid=e2fs --disable-nls CFLAGS="-Wno-unguarded-availability-new" --with-includes="$(BREW_PREFIX)/include:$(ICU_PREFIX)/include:$(LLVM_PREFIX)/include" --with-libraries="$(BREW_PREFIX)/lib:$(ICU_PREFIX)/lib:$(LLVM_PREFIX)/lib"
    else ifeq ($(PLATFORM),linux)
        CONFIGURE_FLAGS = --prefix=$(PREFIX) --with-openssl --with-icu --with-lz4 --with-zstd --with-libxml --with-llvm --with-uuid=e2fs --disable-nls
    else ifeq ($(PLATFORM),win32)
        # Windows full build with OpenSSL and enterprise features via vcpkg
        VCPKG_ROOT := C:/vcpkg/installed/x64-windows-static
        CONFIGURE_FLAGS = --prefix=$(PREFIX) --with-openssl --with-icu --with-lz4 --with-zstd --with-libxml --with-llvm --with-uuid=e2fs --disable-nls --with-includes="$(VCPKG_ROOT)/include" --with-libraries="$(VCPKG_ROOT)/lib" CPPFLAGS="-I$(VCPKG_ROOT)/include" LDFLAGS="-L$(VCPKG_ROOT)/lib"
    endif
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
ifeq ($(PLATFORM),darwin)
	cd $(POSTGRES_SRC) && PKG_CONFIG_PATH="$(ICU_PREFIX)/lib/pkgconfig:$(BREW_PREFIX)/lib/pkgconfig" LLVM_CONFIG="$(LLVM_PREFIX)/bin/llvm-config" ./configure $(CONFIGURE_FLAGS)
else
	cd $(POSTGRES_SRC) && ./configure $(CONFIGURE_FLAGS)
endif

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
	cd $(PGVECTOR_SRC) && make PG_CONFIG=$(PREFIX)/bin/pg_config
	@echo "📦 Installing pgvector..."
	cd $(PGVECTOR_SRC) && make install PG_CONFIG=$(PREFIX)/bin/pg_config

package:
	@echo "📦 Creating distribution package..."
	cd $(DIST_DIR) && tar -czf postgres-$(VARIANT)-$(PLATFORM)-$(ARCH).tar.gz postgres-$(VARIANT)-$(PLATFORM)-$(ARCH)/
	@echo "✅ Built: $(DIST_DIR)/postgres-$(VARIANT)-$(PLATFORM)-$(ARCH).tar.gz"

clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf $(BUILD_DIR) $(DIST_DIR)

info:
	@echo "Platform: $(PLATFORM)-$(ARCH)"
	@echo "Variant: $(VARIANT)"
	@echo "PostgreSQL: $(POSTGRES_VERSION)"
	@echo "pgvector: $(PGVECTOR_VERSION)"
	@echo "Install dir: $(INSTALL_DIR)"