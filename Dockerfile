FROM buildpack-deps:bookworm

ARG USER_NAME=magnum-opus
ARG CARGOAUDIT_VERSION=0.21.2
ARG RUST_VERSION=1.85.0
ARG SWS_VERSION=2.36.0

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN set -eux && \
    apt-get update && \
    rm --force --recursive /var/lib/apt/lists/* && \
    useradd --create-home --shell /bin/bash $USER_NAME

USER $USER_NAME

RUN set -eux && \
    CURL='curl --silent --show-error --fail --tlsv1.3 --proto =https --location' && \
    $CURL https://sh.rustup.rs \
    | bash -s -- -y --default-toolchain $RUST_VERSION && \
    source /home/$USER_NAME/.cargo/env && \
    $CURL https://raw.githubusercontent.com/cargo-bins/cargo-binstall/main/install-from-binstall-release.sh \
    | bash -s && \
    cargo binstall --no-confirm \
        cargo-audit@$CARGOAUDIT_VERSION \
        static-web-server@$SWS_VERSION
