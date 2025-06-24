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
	@echo "🔧 Applying Windows LLVM compatibility patches..."
ifeq ($(PLATFORM),win32)
ifeq ($(VARIANT),full)
	# Fix sys/mman.h issue in llvmjit_inline.cpp - wrap the include
	sed -i '31a #ifdef _WIN32' $(POSTGRES_SRC)/src/backend/jit/llvm/llvmjit_inline.cpp
	sed -i '32a // Windows - no sys/mman.h needed' $(POSTGRES_SRC)/src/backend/jit/llvm/llvmjit_inline.cpp
	sed -i '33a #else' $(POSTGRES_SRC)/src/backend/jit/llvm/llvmjit_inline.cpp
	sed -i 's|#include <sys/mman.h>|#include <sys/mman.h>\n#endif|' $(POSTGRES_SRC)/src/backend/jit/llvm/llvmjit_inline.cpp
	# Fix bind macro conflict in both C++ files - add after postgres.h include
	sed -i '/^#include "postgres.h"/a #ifdef bind\n#undef bind\n#endif' $(POSTGRES_SRC)/src/backend/jit/llvm/llvmjit_inline.cpp
	sed -i '/^#include "postgres.h"/a #ifdef bind\n#undef bind\n#endif' $(POSTGRES_SRC)/src/backend/jit/llvm/llvmjit_wrap.cpp
	# Fix rindex usage in llvmjit.c
	sed -i 's/rindex(/strrchr(/g' $(POSTGRES_SRC)/src/backend/jit/llvm/llvmjit.c
	# Fix Windows LLVM linking issues - AGGRESSIVE MULTI-ANGLE ATTACK
	# 1. Patch main Makefile.shlib 
	sed -i '/SHLIB_LINK.*=/s/$$/ -lstdc++ -lgcc_s -lwinpthread/' $(POSTGRES_SRC)/src/Makefile.shlib
	# 2. Patch LLVM-specific Makefile if it exists
	@if [ -f "$(POSTGRES_SRC)/src/backend/jit/llvm/Makefile" ]; then \
		sed -i '/SHLIB_LINK/s/$$/ -lstdc++ -lgcc_s -lwinpthread/' $(POSTGRES_SRC)/src/backend/jit/llvm/Makefile; \
		echo "LIBS += -lstdc++ -lgcc_s -lwinpthread" >> $(POSTGRES_SRC)/src/backend/jit/llvm/Makefile; \
		echo "override CPPFLAGS += -DWIN32_LEAN_AND_MEAN" >> $(POSTGRES_SRC)/src/backend/jit/llvm/Makefile; \
	fi
	# 3. Patch configure.ac to add Windows C++ linking flags globally
	sed -i '/LDFLAGS.*mingw/s/$$/ -lstdc++ -lgcc_s -lwinpthread/' $(POSTGRES_SRC)/configure || true
	# 4. Force C++ linker for LLVM components on Windows  
	sed -i 's/x86_64-w64-mingw32-gcc/x86_64-w64-mingw32-g++/g' $(POSTGRES_SRC)/src/backend/jit/llvm/Makefile || true
	# 5. Add explicit linking to main postgres build
	echo "LIBS += -lstdc++ -lgcc_s -lwinpthread" >> $(POSTGRES_SRC)/src/backend/Makefile
	# Add missing exports to win32 def file if it exists
	@if [ -f "$(POSTGRES_SRC)/src/backend/postgres.def" ]; then \
		echo "CurrentResourceOwner" >> $(POSTGRES_SRC)/src/backend/postgres.def; \
		echo "pkglib_path" >> $(POSTGRES_SRC)/src/backend/postgres.def; \
		echo "CurrentMemoryContext" >> $(POSTGRES_SRC)/src/backend/postgres.def; \
		echo "TopMemoryContext" >> $(POSTGRES_SRC)/src/backend/postgres.def; \
		echo "MyProcPid" >> $(POSTGRES_SRC)/src/backend/postgres.def; \
		echo "jit_dump_bitcode" >> $(POSTGRES_SRC)/src/backend/postgres.def; \
		echo "proc_exit_inprogress" >> $(POSTGRES_SRC)/src/backend/postgres.def; \
		echo "jit_profiling_support" >> $(POSTGRES_SRC)/src/backend/postgres.def; \
		echo "jit_debugging_support" >> $(POSTGRES_SRC)/src/backend/postgres.def; \
		echo "TTSOpsMinimalTuple" >> $(POSTGRES_SRC)/src/backend/postgres.def; \
		echo "TTSOpsHeapTuple" >> $(POSTGRES_SRC)/src/backend/postgres.def; \
		echo "TTSOpsBufferHeapTuple" >> $(POSTGRES_SRC)/src/backend/postgres.def; \
		echo "TTSOpsVirtual" >> $(POSTGRES_SRC)/src/backend/postgres.def; \
	fi
endif
endif

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