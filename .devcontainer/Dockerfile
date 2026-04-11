FROM mcr.microsoft.com/devcontainers/rust:2-1-trixie

# Packages
RUN apt-get update
RUN apt-get install -y git xdg-utils xdg-utils-cxx libnspr4 libnss3

# Bun
ENV BUN_INSTALL=/usr/local
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="~/.bun/bin:${PATH}"
RUN ln -s /usr/local/bin/bun /usr/local/bin/node

# Tauri
RUN curl -fsSL https://github.com/olivierlemasle/devcontainers-features/raw/refs/heads/main/src/tauri/install.sh | bash

# Deploy NPM -> Bun shim for VSCE
COPY ./npm.sh /usr/local/bin/npm
RUN chmod 777 /usr/local/bin/npm
