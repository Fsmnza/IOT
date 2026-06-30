influxdb:
  image: influxdb:2.7
  ports:
    - "8086:8086"
  environment:
    - DOCKER_INFLUXDB_INIT_MODE=setup
    - DOCKER_INFLUXDB_INIT_USERNAME=fsmnza
    - DOCKER_INFLUXDB_INIT_PASSWORD=IotVladMalika
    - DOCKER_INFLUXDB_INIT_ORG=traffic
    - DOCKER_INFLUXDB_INIT_BUCKET=traffic_data