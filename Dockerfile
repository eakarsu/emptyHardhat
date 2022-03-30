FROM ubuntu

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
    git clone https://github.com/eakarsu/emptyHardhat &&\
    git clone https://github.com/eakarsu/aave-protocol-v2 aave &&\
    git clone https://github.com/enzymefinance/protocol enzyme

#install npm packages and run hardhat node server
RUN cd /home/Research/emptyHardhat &&\
    npm install &&\
    npx hardhat node >& hardhat.node.txt &

#fork main aave
RUN  cd /home/Research/aave &&\
     npm install &&\
     npm run aave:fork:main

#deploy enzyme
RUN /home/Research/enzyme &&\
    npm install &&\
    npx hardhat --network localhost deploy

#Set working directory
WORKDIR /home/Research