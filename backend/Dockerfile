FROM python:3.7.7

RUN apt-get update && apt-get upgrade -y
RUN apt-get install -y python-pip python-dev build-essential

RUN mkdir -p /usr/src/p2t2
WORKDIR /usr/src/p2t2
COPY requirements.txt /usr/src/p2t2

RUN pip install --upgrade pip && pip install -r requirements.txt 
ENTRYPOINT ["flask"]
CMD ["run", "--host=0.0.0.0"]