FROM node:latest

#Get dos2unix to ensure that entrypoint.sh files run on windows
RUN apt-get update && apt-get install -y dos2unix
COPY frontend_entrypoint.sh /frontend_entrypoint.sh
RUN dos2unix /frontend_entrypoint.sh && apt-get --purge remove -y dos2unix && rm -rf /var/lib/apt/lists/*

#Cache dependencies, so they can be moved and used after build
RUN mkdir /usr/src/cache
WORKDIR /usr/src/cache

# Install the application's dependencies into the node_modules's cache directory.
COPY package.json ./
COPY package-lock.json ./
RUN npm install

RUN mkdir -p /usr/src/p2t2
WORKDIR /usr/src/p2t2
