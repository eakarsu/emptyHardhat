FROM ubuntu
#testing
#sudo docker build -t prosperity .
#sudo docker container run --name prosperity -p 8545:8545 -d -t prosperity
#sudo docker exec -i -t prosperity   /bin/bash
#Install git and nvm and nodejs
RUN apt-get update &&\
    apt-get install -y git curl &&\
    curl -fsSL https://deb.nodesource.com/setup_16.x |  bash - &&\
    apt-get install -y nodejs &&\
    node -v &&\
    npm -v


#clone repositories
RUN mkdir /home/Research &&\
    cd /home/Research &&\
    git clone https://github.com/eakarsu/emptyHardhat  &&\
    git clone https://github.com/eakarsu/aave-protocol-v2 aave &&\
    git clone https://github.com/eakarsu/enzymeprotocol enzyme

#install npm packages and run hardhat node server
RUN cd /home/Research/emptyHardhat &&\
    npm install

#fork main aave
RUN  cd /home/Research/aave &&\
     npm install

#deploy enzyme
RUN cd /home/Research/enzyme &&\
    npm install yarn -g &&\
    yarn install &&\
    yarn compile

#Set working directory
WORKDIR /home/Research

COPY bootstrap.sh /home/Research/
ENTRYPOINT ["/home/Research/bootstrap.sh"]