# Jobber

Do you like Lambda, the concept of disposable functions? Well this is surely the solution for you! Do you find OpenFaaS overly complicated for a basic setup? Me too!

### Future additions

- Migrate entrypoint.js to its own package with bundling
- Migrate the Framed TCP protocol to its own package which can be shared by the Server and Entrypoint packages.
- Run jobs within an isolated context for security, this will be most likely in the form of Docker.
- Support other languages (python? native binaries?).
- Support CommonJS?
- With the support of docker, we could allow for remote docker-hosts.

### Security considerations

- Each job does not run in isolation, with the same permission scope as the broker process.
