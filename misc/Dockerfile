#       Create a separate directory for the Dockerfile and place all necessary files within the same directory as the Dockerfile.
#       
#       A Dockerfile uses the following commands for building the images:
#       
#           ADD: Copy files from a source on the host to the container's own filesystem at the set destination.
#           CMD: Execute a specific command within the container.
#           ENTRYPOINT: Set a default application to be used every time a container is created with the image.
#           ENV: Set environment variables.
#           EXPOSE: Expose a specific port to enable networking between the container and the outside world.
#           FROM: Define the base image used to start the build process.
#           MAINTAINER: Define the full name and email address of the image creator.
#           RUN: Central executing directive for Dockerfiles.
#           USER: Set the UID (the username) that will run the container.
#           VOLUME: Enable access from the container to a directory on the host machine.
#           WORKDIR: Set the path where the command, defined with CMD, is to be executed.
#        
#       Every command must be used. You will create a working Dockerfile example in the following section.

# base image
FROM debian:9.11-slim

# set working directory
RUN mkdir /sigmon
WORKDIR /sigmon

# We're going to need this during setup
ADD . /sigmon

#install software dependencies
RUN apt-get update
RUN apt-get -y install openssh-server libpcap0.8 libpcap0.8-dev wireless-tools aircrack-ng curl 
RUN curl -o /sigmon/nvm-install.sh https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh
RUN bash /sigmon/nvm-install.sh
ENV NVM_DIR="$HOME/.nvm"
RUN nvm lts
RUN cd /sigmon
RUN git clone http://github.com/terbo/node-signal-monitor
RUN mv node-signal-monitor/* /sigmon
RUN npm i
