FROM docker.io/oven/bun:slim

# Config Bun
ENV PATH="~/.bun/bin:${PATH}"
RUN ln -s /usr/local/bin/bun /usr/local/bin/node

# Update packages
RUN if [ "slim" == "alpine" ] ; then apk update ; else apt-get update ; fi

# Install Git
RUN if [ "slim" == "alpine" ] ; then apk add git ; else apt-get install -y git ; fi

# Deploy NPM shim
COPY ./npm.sh /usr/local/bin/npm
RUN chmod 777 /usr/local/bin/npm