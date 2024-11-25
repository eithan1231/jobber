# Jobber

Do you like Lambda, the concept of disposable functions? Well this is surely the solution for you! Do you find OpenFaaS overly complicated for a basic setup? Me too!

### Future additions

- Support environment variables
- Run jobs within an isolated context for security, this will be most likely in the form of Docker.
- Support secrets
- Support other languages (python? native binaries?).
- Support CommonJS?
- With the support of docker, we could allow for remote docker-hosts.

### Security considerations

- Each job does not run in isolation, with the same permission scope as the broker process.
