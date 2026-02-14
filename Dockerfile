FROM buildpack-deps:trixie

ARG USER_NAME=magnum-opus

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN set -eux && \
    apt-get update && \
    rm --force --recursive /var/lib/apt/lists/* && \
    useradd --create-home --shell /bin/bash $USER_NAME

USER $USER_NAME

RUN set -eux && \
    curl --fail --silent --show-error --location https://deno.land/install.sh | bash -s -- --yes
