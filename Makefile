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
        # Windows full build with OpenSSL and enterprise features via MSYS2/MinGW
        MINGW_PREFIX := /mingw64
        CONFIGURE_FLAGS = --host=x86_64-w64-mingw32 --prefix=$(PREFIX) --with-openssl --with-icu --with-lz4 --with-zstd --with-libxml --with-llvm --disable-nls --with-includes="$(MINGW_PREFIX)/include" --with-libraries="$(MINGW_PREFIX)/lib"
    endif
endif

.PHONY: all build clean download extract patch configure compile install package test

all: build

build: download extract patch configure compile install package

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

patch:
	@echo "🔧 Applying minimal Windows LLVM compatibility patches..."
ifeq ($(PLATFORM),win32)
ifeq ($(VARIANT),full)
	# Fix bind macro conflict in C++ files - add after postgres.h include
	sed -i '/^#include "postgres.h"/a #ifdef bind\n#undef bind\n#endif' $(POSTGRES_SRC)/src/backend/jit/llvm/llvmjit_wrap.cpp
	sed -i '/^#include "postgres.h"/a #ifdef bind\n#undef bind\n#endif' $(POSTGRES_SRC)/src/backend/jit/llvm/llvmjit_inline.cpp || true
	# Fix sys/mman.h missing on Windows - replace with Windows equivalent
	sed -i 's|#include <sys/mman.h>|#ifdef _WIN32\n#include <windows.h>\n#else\n#include <sys/mman.h>\n#endif|g' $(POSTGRES_SRC)/src/backend/jit/llvm/llvmjit_inline.cpp || true
	# Fix netinet/in.h missing on Windows - replace with Windows equivalent
	sed -i 's|#include <netinet/in.h>|#ifdef _WIN32\n#include <winsock2.h>\n#include <ws2tcpip.h>\n#else\n#include <netinet/in.h>\n#endif|g' $(POSTGRES_SRC)/src/include/port.h || true
	# Fix arpa/inet.h missing on Windows - already covered by winsock2.h
	sed -i 's|#include <arpa/inet.h>|#ifndef _WIN32\n#include <arpa/inet.h>\n#endif|g' $(POSTGRES_SRC)/src/include/port.h || true
	# Fix rindex usage in llvmjit.c 
	sed -i 's/rindex(/strrchr(/g' $(POSTGRES_SRC)/src/backend/jit/llvm/llvmjit.c || true
endif
endif

configure:
	@echo "⚙️  Configuring PostgreSQL build..."
ifeq ($(PLATFORM),win32)
ifeq ($(VARIANT),full)
	@echo "🚀 Using Meson for Windows full variant with LLVM support!"
	cd $(POSTGRES_SRC) && meson setup build \
		--prefix=$(PREFIX) \
		--default-library=shared \
		-Dicu=enabled \
		-Dssl=openssl \
		-Dlz4=enabled \
		-Dzstd=enabled \
		-Dlibxml=enabled \
		-Dllvm=enabled \
		-Dnls=disabled \
		-Dc_link_args='-Wl,--export-all-symbols' \
		-Dcpp_link_args='-Wl,--export-all-symbols'
else
	@echo "🔧 Using autotools for Windows lite variant"
	cd $(POSTGRES_SRC) && ./configure $(CONFIGURE_FLAGS)
endif
else
	@echo "🔧 Using autotools for $(PLATFORM) $(VARIANT) variant (proven to work)"
ifeq ($(PLATFORM),darwin)
	cd $(POSTGRES_SRC) && PKG_CONFIG_PATH="$(ICU_PREFIX)/lib/pkgconfig:$(BREW_PREFIX)/lib/pkgconfig" LLVM_CONFIG="$(LLVM_PREFIX)/bin/llvm-config" ./configure $(CONFIGURE_FLAGS)
else
	cd $(POSTGRES_SRC) && ./configure $(CONFIGURE_FLAGS)
endif
endif

compile:
	@echo "🔨 Compiling PostgreSQL..."
ifeq ($(PLATFORM),win32)
ifeq ($(VARIANT),full)
	@echo "🚀 Building with Ninja (Meson backend)"
	cd $(POSTGRES_SRC) && ninja -C build
else
	@echo "🔧 Building with Make (autotools)"
	cd $(POSTGRES_SRC) && make -C ./src/backend generated-headers
	cd $(POSTGRES_SRC) && make -j$(shell nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)
endif
else
	@echo "🔧 Building with Make (autotools - proven to work)"
	cd $(POSTGRES_SRC) && make -C ./src/backend generated-headers
	cd $(POSTGRES_SRC) && make -j$(shell nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)
endif

install:
	@echo "📦 Installing PostgreSQL..."
	mkdir -p $(INSTALL_DIR)
ifeq ($(PLATFORM),win32)
ifeq ($(VARIANT),full)
	@echo "🚀 Installing with Meson"
	cd $(POSTGRES_SRC) && meson install -C build
else
	@echo "🔧 Installing with Make"
	cd $(POSTGRES_SRC) && make install
endif
else
	@echo "🔧 Installing with Make (autotools - proven to work)"
	cd $(POSTGRES_SRC) && make install
endif
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